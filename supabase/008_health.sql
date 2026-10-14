-- GREATNESS : données Apple Santé envoyées par un Raccourci iOS (pas, sommeil, variabilité cardiaque, fréquence
-- cardiaque au repos, poids, énergie active), rangées par jour. À lancer après schema.sql (fait automatiquement par
-- le déploiement GitHub). Relançable sans risque.
-- Le Raccourci n'a pas le jeton de connexion : il utilise une clé à part (« pseudo.secret »), révocable, qui ne sert
-- qu'à déposer ces mesures, via la fonction « health ». La base n'en garde que l'empreinte (SHA-256).

alter table public.gt_accounts add column if not exists health_key text;

create table if not exists public.gt_health (
  username text not null references public.gt_accounts(username) on delete cascade,
  day      date not null,
  data     jsonb not null default '{}'::jsonb,
  at       timestamptz not null default now(),
  primary key (username, day)
);
alter table public.gt_health enable row level security;
revoke all on public.gt_health from anon, authenticated;

-- Nouvelle clé pour le Raccourci (l'ancienne cesse de marcher), renvoyée une seule fois ; p_revoke : déconnecter
create or replace function public.gt_health_key(p_token text, p_revoke boolean default false) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := gt_user(p_token); k text;
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if p_revoke then
    update gt_accounts set health_key = null where username = u;
    delete from gt_health where username = u;
    return json_build_object('ok', true);
  end if;
  k := encode(gen_random_bytes(18), 'hex');
  update gt_accounts set health_key = encode(digest(k, 'sha256'), 'hex') where username = u;
  return json_build_object('key', u || '.' || k);
end $$;

-- Dépôt des mesures d'un jour (appelé par la fonction « health » avec la clé serveur) : les nouvelles valeurs
-- complètent ou remplacent celles du même jour ; on garde 120 jours. La clé est « pseudo.secret » : le secret
-- (hexadécimal) suit le dernier point, le pseudo peut lui-même contenir des points.
create or replace function public.gt_health_put(p_key text, p_day date, p_data jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := substring(coalesce(p_key, '') from '^(.+)\.[0-9a-f]{16,64}$');
        k text := substring(coalesce(p_key, '') from '\.([0-9a-f]{16,64})$');
begin
  if u is null or k is null or not exists (select 1 from gt_accounts where username = u and health_key = encode(digest(k, 'sha256'), 'hex')) then
    return json_build_object('error', 'BAD_KEY');
  end if;
  if p_day is null or p_day > current_date + 1 or p_day < current_date - 30 then return json_build_object('error', 'BAD_DAY'); end if;
  insert into gt_health(username, day, data, at) values (u, p_day, coalesce(p_data, '{}'::jsonb), now())
  on conflict (username, day) do update set data = gt_health.data || excluded.data, at = now();
  delete from gt_health where username = u and day < p_day - 120;
  return json_build_object('ok', true, 'day', p_day);
end $$;

-- Pour l'app : les mesures reçues depuis p_since (60 derniers jours par défaut), et si un Raccourci est relié
create or replace function public.gt_health_pull(p_token text, p_since date default null) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token);
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  return json_build_object(
    'linked', (select health_key is not null from gt_accounts where username = u),
    'days', coalesce((select json_agg(json_build_object('day', h.day, 'data', h.data, 'at', h.at) order by h.day)
      from gt_health h where h.username = u and h.day >= coalesce(p_since, current_date - 60)), '[]'::json));
end $$;

revoke all on function public.gt_health_put(text, date, jsonb) from public, anon, authenticated;
grant execute on function public.gt_health_key(text, boolean), public.gt_health_pull(text, date) to anon;
