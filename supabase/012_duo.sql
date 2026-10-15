-- GREATNESS : séance en duo à distance. Deux amis s'entraînent en même temps, chacun chez soi : chacun voit où en est
-- l'autre (exercice, série, charge), ses séries validées et ses encouragements, presque en direct (l'app interroge le
-- serveur toutes les 4 secondes pendant la séance). Une salle se crée avec un code de 6 caractères, valable 4 h.
-- À lancer après schema.sql (fait automatiquement par le déploiement GitHub). Relançable sans risque.

create table if not exists public.gt_duo (
  code       text primary key,
  host       text not null references public.gt_accounts(username) on delete cascade,
  guest      text references public.gt_accounts(username) on delete cascade,
  host_st    jsonb not null default '{}'::jsonb,
  guest_st   jsonb not null default '{}'::jsonb,
  events     jsonb not null default '[]'::jsonb, -- [{ n, from, e, at }] : encouragements, arrivée, départ
  seq        int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '4 hours'
);
alter table public.gt_duo enable row level security;
revoke all on public.gt_duo from anon, authenticated;

-- Prénom affiché (celui du profil, sinon le pseudo)
create or replace function public.gt_duo_name(u text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(left(trim(data->'profile'->>'name'), 30), ''), username) from gt_accounts where username = u;
$$;

-- Événement dans la salle (les 40 derniers sont gardés)
create or replace function public.gt_duo_event(p_code text, p_from text, p_e text) returns void
language sql security definer set search_path = public as $$
  update gt_duo set seq = seq + 1,
    events = (select coalesce(jsonb_agg(x order by (x->>'n')::int), '[]'::jsonb) from (
      select x from jsonb_array_elements(events || jsonb_build_array(jsonb_build_object('n', seq + 1, 'from', p_from, 'e', p_e, 'at', (extract(epoch from now()) * 1000)::bigint))) x
      order by (x->>'n')::int desc limit 40) t)
  where code = p_code;
$$;

-- Nouvelle salle : un code facile à dicter (sans 0/O ni 1/I/L) ; une seule salle ouverte par personne
create or replace function public.gt_duo_create(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := gt_user(p_token); c text; abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  delete from gt_duo where expires_at < now() or host = u;
  loop
    c := (select string_agg(substr(abc, 1 + (get_byte(b, i) % length(abc)), 1), '') from (select gen_random_bytes(6) b) r, generate_series(0, 5) i);
    exit when not exists (select 1 from gt_duo where code = c);
  end loop;
  insert into gt_duo(code, host) values (c, u);
  return json_build_object('code', c, 'role', 'host');
end $$;

-- Rejoindre avec le code
create or replace function public.gt_duo_join(p_token text, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); d gt_duo; k text := upper(trim(coalesce(p_code, '')));
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  select * into d from gt_duo where code = k and expires_at > now() for update;
  if d.code is null then return json_build_object('error', 'NO_ROOM'); end if;
  if d.host = u then return json_build_object('ok', true, 'role', 'host', 'code', k, 'partner', case when d.guest is null then null else gt_duo_name(d.guest) end); end if;
  if d.guest is not null and d.guest <> u then return json_build_object('error', 'FULL'); end if;
  if d.guest is null then
    update gt_duo set guest = u where code = k;
    perform gt_duo_event(k, u, 'join');
  end if;
  return json_build_object('ok', true, 'role', 'guest', 'code', k, 'partner', gt_duo_name(d.host));
end $$;

-- Toutes les 4 s : j'envoie où j'en suis (p_state, 2 Ko max), je reçois où en est l'autre et les nouveaux événements
create or replace function public.gt_duo_sync(p_token text, p_code text, p_state jsonb default null, p_after int default 0) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); d gt_duo; me text; other text; st jsonb;
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  select * into d from gt_duo where code = upper(trim(coalesce(p_code, ''))) and expires_at > now();
  if d.code is null then return json_build_object('error', 'NO_ROOM'); end if;
  if u = d.host then me := 'host'; other := d.guest; elsif u = d.guest then me := 'guest'; other := d.host;
  else return json_build_object('error', 'NOT_MEMBER'); end if;
  if p_state is not null and octet_length(p_state::text) <= 2000 then
    st := p_state || jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint);
    if me = 'host' then update gt_duo set host_st = st where code = d.code; else update gt_duo set guest_st = st where code = d.code; end if;
  end if;
  return json_build_object('role', me, 'partner', case when other is null then null else gt_duo_name(other) end,
    'state', case when other is null then null when me = 'host' then d.guest_st else d.host_st end,
    'events', (select coalesce(json_agg(x order by (x->>'n')::int), '[]'::json) from jsonb_array_elements(d.events) x
               where (x->>'n')::int > coalesce(p_after, 0) and x->>'from' <> u),
    'seq', d.seq, 'expires', (extract(epoch from d.expires_at) * 1000)::bigint);
end $$;

-- Encouragement (émojis autorisés seulement)
create or replace function public.gt_duo_cheer(p_token text, p_code text, p_emoji text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); k text := upper(trim(coalesce(p_code, '')));
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if p_emoji is null or p_emoji not in ('🔥', '💪', '👏', '😤', '🏆', '❤️') then return json_build_object('error', 'BAD_EMOJI'); end if;
  if not exists (select 1 from gt_duo where code = k and expires_at > now() and u in (host, guest)) then return json_build_object('error', 'NO_ROOM'); end if;
  perform gt_duo_event(k, u, p_emoji);
  return json_build_object('ok', true);
end $$;

-- Quitter : l'hôte ferme la salle, l'invité libère sa place
create or replace function public.gt_duo_leave(p_token text, p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); k text := upper(trim(coalesce(p_code, '')));
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if exists (select 1 from gt_duo where code = k and host = u) then
    delete from gt_duo where code = k;
  elsif exists (select 1 from gt_duo where code = k and guest = u) then
    update gt_duo set guest = null, guest_st = '{}'::jsonb where code = k;
    perform gt_duo_event(k, u, 'bye');
  end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.gt_duo_name(text), public.gt_duo_event(text, text, text) from public, anon, authenticated;
grant execute on function public.gt_duo_create(text), public.gt_duo_join(text, text), public.gt_duo_sync(text, text, jsonb, int),
  public.gt_duo_cheer(text, text, text), public.gt_duo_leave(text, text) to anon;
