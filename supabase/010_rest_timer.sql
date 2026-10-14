-- GREATNESS : fin du repos annoncée sur l'écran verrouillé (Web Push). À lancer après 003_push.sql (fait
-- automatiquement par le déploiement GitHub). Relançable sans risque.
-- Quand le téléphone se verrouille pendant un repos, l'app programme ici l'alerte de CE téléphone ; la fonction
-- « reminders » attend la fin du repos puis envoie la notification. Revenir dans l'app avant l'annule.

create table if not exists public.gt_timers (
  id        text primary key,
  username  text not null references public.gt_accounts(username) on delete cascade,
  endpoint  text not null,
  fire_at   timestamptz not null,
  title     text not null default '',
  body      text not null default '',
  state     text not null default 'wait', -- wait (en attente), sent (envoyée), cancelled (annulée)
  at        timestamptz not null default now()
);
create index if not exists gt_timers_endpoint on public.gt_timers(endpoint, state);
alter table public.gt_timers enable row level security;
revoke all on public.gt_timers from anon, authenticated;

-- Programme l'alerte (appelée par la fonction avec le jeton de l'app) : un seul minuteur en attente par téléphone,
-- 15 min au plus. Renvoie l'heure d'envoi (ms).
create or replace function public.gt_timer_set(p_token text, p_id text, p_endpoint text, p_in_ms int, p_title text, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); f timestamptz;
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if coalesce(p_id, '') !~ '^[A-Za-z0-9_-]{6,64}$' then return json_build_object('error', 'BAD_ID'); end if;
  if p_in_ms is null or p_in_ms < 0 or p_in_ms > 900000 then return json_build_object('error', 'BAD_DELAY'); end if;
  if not exists (select 1 from gt_push_subs where endpoint = p_endpoint and username = u) then return json_build_object('error', 'NO_SUB'); end if;
  if exists (select 1 from gt_timers where id = p_id and username <> u) then return json_build_object('error', 'BAD_ID'); end if;
  update gt_timers set state = 'cancelled' where endpoint = p_endpoint and state = 'wait' and id <> p_id;
  f := now() + make_interval(secs => p_in_ms / 1000.0);
  insert into gt_timers(id, username, endpoint, fire_at, title, body) values (p_id, u, p_endpoint, f, left(coalesce(p_title, ''), 80), left(coalesce(p_body, ''), 160))
  on conflict (id) do update set fire_at = excluded.fire_at, title = excluded.title, body = excluded.body, state = 'wait', at = now();
  delete from gt_timers where at < now() - interval '1 day';
  return json_build_object('ok', true, 'fire_at', (extract(epoch from f) * 1000)::bigint);
end $$;

-- Annule l'alerte (l'app revient au premier plan avant la fin du repos)
create or replace function public.gt_timer_cancel(p_token text, p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token);
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  update gt_timers set state = 'cancelled' where id = p_id and username = u and state = 'wait';
  return json_build_object('ok', true);
end $$;

-- Pour la fonction (clé serveur) : l'heure d'envoi d'un minuteur encore en attente (null sinon)
create or replace function public.gt_timer_get(p_id text) returns json
language sql security definer set search_path = public as $$
  select json_build_object('fire_at', (extract(epoch from fire_at) * 1000)::bigint) from gt_timers where id = p_id and state = 'wait';
$$;

-- Au moment d'envoyer : prend le minuteur une seule fois (s'il n'a pas été annulé) et renvoie l'abonnement du téléphone
create or replace function public.gt_timer_take(p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare r gt_timers;
begin
  update gt_timers t set state = 'sent' where t.id = p_id and t.state = 'wait' returning t.* into r;
  if r.id is null then return null; end if;
  return (select json_build_object('endpoint', s.endpoint, 'sub', s.sub, 'title', r.title, 'body', r.body) from gt_push_subs s where s.endpoint = r.endpoint);
end $$;

revoke all on function public.gt_timer_set(text, text, text, int, text, text), public.gt_timer_get(text), public.gt_timer_take(text) from public, anon, authenticated;
grant execute on function public.gt_timer_cancel(text, text) to anon;
