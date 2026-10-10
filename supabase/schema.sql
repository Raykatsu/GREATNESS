-- GREATNESS : comptes (pseudo + code en chiffres) et données synchronisées.
-- À coller dans Supabase → SQL Editor → New query → Run. Le script peut être relancé.
--
-- Sécurité :
--  * les tables ne sont PAS accessibles directement (RLS activé, aucune policy) ;
--  * tout passe par les fonctions ci-dessous ;
--  * le code est haché avec bcrypt (jamais stocké en clair) ;
--  * 5 codes faux d'affilée bloquent le compte 15 minutes ;
--  * après connexion, l'appareil utilise un jeton aléatoire, pas le code.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.gt_accounts (
  username     text primary key check (username ~ '^[a-z0-9_.-]{3,20}$'),
  pin_hash     text not null,
  data         jsonb not null default '{}'::jsonb,
  failed       int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.gt_tokens (
  token      text primary key,
  username   text not null references public.gt_accounts(username) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.gt_accounts enable row level security;
alter table public.gt_tokens enable row level security;
revoke all on public.gt_accounts, public.gt_tokens from anon, authenticated;

create or replace function public.gt_new_token(p_username text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(32), 'hex');
begin
  insert into gt_tokens(token, username) values (t, p_username);
  return t;
end $$;

create or replace function public.gt_signup(p_username text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := lower(trim(p_username));
begin
  if u !~ '^[a-z0-9_.-]{3,20}$' then return json_build_object('error', 'USERNAME_INVALID'); end if;
  if p_pin !~ '^[0-9]{4,6}$' then return json_build_object('error', 'PIN_INVALID'); end if;
  if exists (select 1 from gt_accounts where username = u) then return json_build_object('error', 'USERNAME_TAKEN'); end if;
  insert into gt_accounts(username, pin_hash) values (u, crypt(p_pin, gen_salt('bf', 8)));
  return json_build_object('token', gt_new_token(u), 'username', u, 'data', '{}'::jsonb);
end $$;

create or replace function public.gt_login(p_username text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a gt_accounts%rowtype; u text := lower(trim(p_username));
begin
  select * into a from gt_accounts where username = u for update;
  if not found then
    perform pg_sleep(0.3);
    return json_build_object('error', 'BAD_CREDENTIALS');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return json_build_object('error', 'LOCKED');
  end if;
  if crypt(coalesce(p_pin, ''), a.pin_hash) <> a.pin_hash then
    update gt_accounts
       set failed = a.failed + 1,
           locked_until = case when a.failed + 1 >= 5 then now() + interval '15 minutes' else null end
     where username = u;
    return json_build_object('error', case when a.failed + 1 >= 5 then 'LOCKED' else 'BAD_CREDENTIALS' end);
  end if;
  update gt_accounts set failed = 0, locked_until = null where username = u;
  return json_build_object('token', gt_new_token(u), 'username', u, 'data', a.data);
end $$;

create or replace function public.gt_user(p_token text) returns text
language sql security definer set search_path = public as $$
  select username from gt_tokens where token = p_token and length(p_token) = 64
$$;

create or replace function public.gt_pull(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); d jsonb;
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  select data into d from gt_accounts where username = u;
  return json_build_object('data', d);
end $$;

create or replace function public.gt_push(p_token text, p_data jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token);
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if octet_length(p_data::text) > 5000000 then return json_build_object('error', 'TOO_BIG'); end if;
  update gt_accounts set data = p_data, updated_at = now() where username = u;
  return json_build_object('ok', true);
end $$;

create or replace function public.gt_change_pin(p_token text, p_old text, p_new text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := gt_user(p_token); h text;
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if p_new !~ '^[0-9]{4,6}$' then return json_build_object('error', 'PIN_INVALID'); end if;
  select pin_hash into h from gt_accounts where username = u;
  if crypt(coalesce(p_old, ''), h) <> h then return json_build_object('error', 'BAD_CREDENTIALS'); end if;
  update gt_accounts set pin_hash = crypt(p_new, gen_salt('bf', 8)) where username = u;
  delete from gt_tokens where username = u and token <> p_token; -- déconnecte les autres appareils
  return json_build_object('ok', true);
end $$;

revoke all on function public.gt_new_token(text), public.gt_user(text) from public, anon, authenticated;
grant execute on function public.gt_signup(text, text), public.gt_login(text, text), public.gt_pull(text),
  public.gt_push(text, jsonb), public.gt_change_pin(text, text, text) to anon;
