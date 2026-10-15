-- GREATNESS : remontée des plantages de l'app, pour les corriger vite. Rien de personnel : le message d'erreur,
-- l'endroit dans le code, la version de l'app et le navigateur. Les erreurs identiques sont regroupées (compteur),
-- 30 jours gardés. Le bilan des 7 derniers jours s'affiche dans le déploiement GitHub (étape « Erreurs signalées »).
-- À lancer après schema.sql (fait automatiquement par le déploiement GitHub). Relançable sans risque.

create table if not exists public.gt_errors (
  key      text primary key,          -- empreinte du message, de l'endroit et de la version
  msg      text not null,
  place    text not null default '',  -- « js/live.js:412:15 »
  stack    text not null default '',
  version  text not null default '',
  ua       text not null default '',
  count    int not null default 1,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now()
);
alter table public.gt_errors enable row level security;
revoke all on public.gt_errors from anon, authenticated;

-- Appelée par l'app (sans compte : une erreur peut arriver avant la connexion). Bornée : textes coupés,
-- 500 erreurs différentes au plus, pas plus de 300 nouvelles par heure.
create or replace function public.gt_error_log(p_msg text, p_place text default '', p_stack text default '', p_version text default '', p_ua text default '') returns json
language plpgsql security definer set search_path = public, extensions as $$
declare m text := left(trim(coalesce(p_msg, '')), 300); pl text := left(coalesce(p_place, ''), 120); v text := left(coalesce(p_version, ''), 40); k text;
begin
  if m = '' then return json_build_object('error', 'EMPTY'); end if;
  k := encode(digest(m || '|' || pl || '|' || v, 'sha256'), 'hex');
  update gt_errors set count = count + 1, last_at = now(), ua = left(coalesce(p_ua, ''), 160) where key = k;
  if found then return json_build_object('ok', true); end if;
  if (select count(*) from gt_errors where first_at > now() - interval '1 hour') >= 300 then return json_build_object('error', 'LIMIT'); end if;
  insert into gt_errors(key, msg, place, stack, version, ua) values (k, m, pl, left(coalesce(p_stack, ''), 1200), v, left(coalesce(p_ua, ''), 160))
    on conflict (key) do update set count = gt_errors.count + 1, last_at = now();
  delete from gt_errors where last_at < now() - interval '30 days';
  delete from gt_errors where key in (select key from gt_errors order by last_at desc offset 500);
  return json_build_object('ok', true);
end $$;

-- Pour le bilan (clé serveur) : les erreurs des derniers jours, les plus fréquentes d'abord
create or replace function public.gt_errors_recent(p_days int default 7, p_limit int default 15) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(x), '[]'::json) from (
    select msg, place, version, count, last_at from gt_errors where last_at > now() - make_interval(days => greatest(1, least(p_days, 30)))
    order by count desc, last_at desc, key limit greatest(1, least(p_limit, 50))) x; -- key : ordre stable entre ex aequo
$$;

grant execute on function public.gt_error_log(text, text, text, text, text) to anon;
revoke all on function public.gt_errors_recent(int, int) from public, anon, authenticated;
