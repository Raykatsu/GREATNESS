-- GREATNESS : amis, classement et défis. À lancer UNE fois après schema.sql
-- (Supabase → SQL Editor → New query → coller → Run). Relançable sans risque.
--
-- Vie privée : un ami ne voit que ton résumé public (prénom, rang, stats de la
-- semaine, records, 5 dernières séances), et seulement après que vous ayez
-- accepté l'amitié tous les deux.

alter table public.gt_accounts add column if not exists public jsonb not null default '{}'::jsonb;

create table if not exists public.gt_friends (
  a          text not null references public.gt_accounts(username) on delete cascade, -- qui demande
  b          text not null references public.gt_accounts(username) on delete cascade, -- qui reçoit
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (a, b)
);
alter table public.gt_friends enable row level security;
revoke all on public.gt_friends from anon, authenticated;

-- La sauvegarde met aussi à jour le résumé public.
create or replace function public.gt_push(p_token text, p_data jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token);
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if octet_length(p_data::text) > 5000000 then return json_build_object('error', 'TOO_BIG'); end if;
  update gt_accounts set data = p_data, public = coalesce(p_data->'public', public), updated_at = now() where username = u;
  return json_build_object('ok', true);
end $$;

create or replace function public.gt_friend_request(p_token text, p_username text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); t text := lower(trim(p_username));
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if t = u then return json_build_object('error', 'SELF'); end if;
  if not exists (select 1 from gt_accounts where username = t) then return json_build_object('error', 'NOT_FOUND'); end if;
  if exists (select 1 from gt_friends where a = t and b = u) then
    update gt_friends set status = 'accepted' where a = t and b = u;
    return json_build_object('status', 'accepted');
  end if;
  if exists (select 1 from gt_friends where a = u and b = t) then
    return json_build_object('status', (select status from gt_friends where a = u and b = t));
  end if;
  if (select count(*) from gt_friends where a = u and status = 'pending') >= 50 then return json_build_object('error', 'TOO_MANY'); end if;
  insert into gt_friends(a, b) values (u, t);
  return json_build_object('status', 'pending');
end $$;

create or replace function public.gt_friend_respond(p_token text, p_username text, p_accept boolean) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); t text := lower(trim(p_username));
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if p_accept then update gt_friends set status = 'accepted' where a = t and b = u;
  else delete from gt_friends where a = t and b = u; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.gt_friend_remove(p_token text, p_username text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); t text := lower(trim(p_username));
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  delete from gt_friends where (a = u and b = t) or (a = t and b = u);
  return json_build_object('ok', true);
end $$;

create or replace function public.gt_friends(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token);
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  return json_build_object('friends', coalesce((
    select json_agg(x) from (
      select case when f.a = u then f.b else f.a end as username, 'accepted' as status, acc.public
        from gt_friends f join gt_accounts acc on acc.username = case when f.a = u then f.b else f.a end
       where (f.a = u or f.b = u) and f.status = 'accepted'
      union all
      select f.a, 'incoming', jsonb_build_object('name', acc.public->'name')
        from gt_friends f join gt_accounts acc on acc.username = f.a
       where f.b = u and f.status = 'pending'
      union all
      select f.b, 'outgoing', '{}'::jsonb from gt_friends f where f.a = u and f.status = 'pending'
    ) x), '[]'::json));
end $$;

grant execute on function public.gt_friend_request(text, text), public.gt_friend_respond(text, text, boolean),
  public.gt_friend_remove(text, text), public.gt_friends(text) to anon;
