-- GREATNESS : IA en ligne (Gemini) pour le coach. À lancer UNE fois après schema.sql
-- (Supabase → SQL Editor → New query → coller → Run). Relançable sans risque.
-- La clé Gemini n'est jamais dans l'app : elle est dans les secrets de la fonction « coach ».
-- Ici : un compteur de messages par compte et par jour, pour rester dans le quota gratuit.

create table if not exists public.gt_ai_usage (
  username text not null references public.gt_accounts(username) on delete cascade,
  day      date not null,
  n        int  not null default 0,
  primary key (username, day)
);
alter table public.gt_ai_usage enable row level security;
revoke all on public.gt_ai_usage from anon, authenticated;

-- Appelée par la fonction « coach » (jamais par l'app) : vérifie le jeton et compte un message.
create or replace function public.gt_ai_take(p_token text, p_limit int default 80) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); c int;
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  insert into gt_ai_usage(username, day, n) values (u, current_date, 1)
    on conflict (username, day) do update set n = gt_ai_usage.n + 1
    returning n into c;
  if c > p_limit then return json_build_object('error', 'LIMIT', 'limit', p_limit); end if;
  delete from gt_ai_usage where day < current_date - 30; -- petit ménage
  return json_build_object('ok', true, 'user', u, 'remaining', p_limit - c);
end $$;

revoke all on function public.gt_ai_take(text, int) from public, anon, authenticated;
