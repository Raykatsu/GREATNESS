-- GREATNESS : « Une idée ? Un souci ? ». Les messages envoyés depuis l'app (idée, souci, autre), signés du pseudo si
-- l'utilisateur le veut, avec la version de l'app, le téléphone et l'écran ouvert. Seuls les administrateurs de
-- l'app (table gt_admins, remplie par le déploiement GitHub, entrée « admin ») les lisent, dans l'app : Moi →
-- Réglages → Retours reçus. Le dépôt étant public, le déploiement n'en affiche que le nombre.
-- À lancer après schema.sql et 013_errors.sql (fait automatiquement par le déploiement GitHub). Relançable sans risque.

create table if not exists public.gt_admins (
  username text primary key references public.gt_accounts(username) on delete cascade
);
alter table public.gt_admins enable row level security;
revoke all on public.gt_admins from anon, authenticated;

create table if not exists public.gt_feedback (
  id         bigint generated always as identity primary key,
  kind       text not null default 'other',  -- idea, bug, other
  msg        text not null,
  username   text references public.gt_accounts(username) on delete set null, -- null : anonyme
  screen     text not null default '',
  version    text not null default '',
  ua         text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists gt_feedback_created on public.gt_feedback(created_at desc);
alter table public.gt_feedback enable row level security;
revoke all on public.gt_feedback from anon, authenticated;

-- Envoi depuis l'app (avec ou sans compte). Borné : 10 messages par compte et par jour, 120 par heure en tout.
create or replace function public.gt_feedback_add(p_token text default null, p_kind text default 'other', p_text text default '',
  p_screen text default '', p_version text default '', p_ua text default '') returns json
language plpgsql security definer set search_path = public as $$
declare u text := case when coalesce(p_token, '') = '' then null else gt_user(p_token) end;
  m text := left(trim(coalesce(p_text, '')), 1000);
  k text := case when p_kind in ('idea', 'bug', 'other') then p_kind else 'other' end;
begin
  if length(m) < 3 then return json_build_object('error', 'EMPTY'); end if;
  if u is not null and (select count(*) from gt_feedback where username = u and created_at > now() - interval '1 day') >= 10 then
    return json_build_object('error', 'LIMIT');
  end if;
  if (select count(*) from gt_feedback where created_at > now() - interval '1 hour') >= 120 then return json_build_object('error', 'LIMIT'); end if;
  insert into gt_feedback(kind, msg, username, screen, version, ua)
    values (k, m, u, left(coalesce(p_screen, ''), 60), left(coalesce(p_version, ''), 40), left(coalesce(p_ua, ''), 160));
  delete from gt_feedback where created_at < now() - interval '365 days';
  return json_build_object('ok', true);
end $$;

-- Administrateur de l'app ?
create or replace function public.gt_is_admin(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('admin', exists (select 1 from gt_admins where username = gt_user(p_token)));
$$;

-- Pour l'administrateur : les derniers retours, et les plantages des derniers jours (013_errors.sql)
create or replace function public.gt_feedback_list(p_token text, p_limit int default 60) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from gt_admins where username = gt_user(p_token)) then return json_build_object('error', 'NOT_ADMIN'); end if;
  return json_build_object(
    'feedback', (select coalesce(json_agg(x), '[]'::json) from (
      select id, kind, msg, coalesce(username, '') as username, screen, version, ua, (extract(epoch from created_at) * 1000)::bigint as at
      from gt_feedback order by created_at desc limit greatest(1, least(coalesce(p_limit, 60), 200))) x),
    'errors', gt_errors_recent(14, 30));
end $$;

-- Pour le bilan du déploiement (clé serveur) : seulement des nombres, le dépôt étant public
create or replace function public.gt_feedback_counts(p_days int default 7) returns json
language sql security definer set search_path = public as $$
  select json_build_object('total', count(*), 'idea', count(*) filter (where kind = 'idea'), 'bug', count(*) filter (where kind = 'bug'),
    'other', count(*) filter (where kind = 'other'), 'admins', (select count(*) from gt_admins))
  from gt_feedback where created_at > now() - make_interval(days => greatest(1, least(p_days, 90)));
$$;

grant execute on function public.gt_feedback_add(text, text, text, text, text, text), public.gt_is_admin(text), public.gt_feedback_list(text, int) to anon;
revoke all on function public.gt_feedback_counts(int) from public, anon, authenticated;
