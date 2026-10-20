-- GREATNESS : vraies notifications de rappel (Web Push). À lancer UNE fois après
-- 002_social.sql (Supabase → SQL Editor → New query → coller → Run). Relançable sans risque.
-- Ensuite : déployer la fonction "reminders" et la planifier (voir SUPABASE.md).

create table if not exists public.gt_push_subs (
  endpoint   text primary key,                     -- adresse unique du téléphone chez Google / Apple / Mozilla
  username   text not null references public.gt_accounts(username) on delete cascade,
  sub        jsonb not null,                       -- abonnement complet (clés de chiffrement)
  tz         text not null default 'Europe/Paris', -- fuseau du téléphone
  last_sent  date,                                 -- dernier jour où un rappel est parti
  created_at timestamptz not null default now()
);
alter table public.gt_push_subs enable row level security;
revoke all on public.gt_push_subs from anon, authenticated;

create or replace function public.gt_push_subscribe(p_token text, p_sub jsonb, p_tz text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token); ep text := p_sub->>'endpoint'; z text := coalesce(nullif(p_tz, ''), 'Europe/Paris');
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  if ep is null or ep !~ '^https://' or octet_length(p_sub::text) > 4000 then return json_build_object('error', 'BAD_SUB'); end if;
  if not exists (select 1 from pg_timezone_names where name = z) then z := 'Europe/Paris'; end if;
  insert into gt_push_subs(endpoint, username, sub, tz) values (ep, u, p_sub, z)
    on conflict (endpoint) do update set username = excluded.username, sub = excluded.sub, tz = excluded.tz;
  -- 10 appareils max par compte : on garde les plus récents
  delete from gt_push_subs where username = u and endpoint in
    (select endpoint from gt_push_subs where username = u order by created_at desc offset 10);
  return json_build_object('ok', true);
end $$;

create or replace function public.gt_push_unsubscribe(p_token text, p_endpoint text) returns json
language plpgsql security definer set search_path = public as $$
declare u text := gt_user(p_token);
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  delete from gt_push_subs where endpoint = p_endpoint and username = u;
  return json_build_object('ok', true);
end $$;

-- Rappels à envoyer maintenant (appelée par la fonction "reminders", jamais par l'app).
-- Un rappel par jour et par téléphone, seulement les jours de séance, pas si la séance est déjà faite.
create or replace function public.gt_push_due(p_now timestamptz default now())
returns table(endpoint text, sub jsonb, title text, body text)
language sql security definer set search_path = public as $$
  with s as (
    select ps.endpoint, ps.sub, ps.tz, ps.last_sent, a.data->'reminders' as r, a.data->'sessions' as sess,
           (p_now at time zone ps.tz) as lt, coalesce(a.data->'profile'->>'lang', 'fr') = 'en' as en
    from gt_push_subs ps join gt_accounts a on a.username = ps.username
    where a.data ? 'reminders'
  ), d as (
    select s.*, (extract(isodow from s.lt)::int - 1)::text as dow,
           coalesce((s.r->>'before')::int, 15) as before,
           s.lt::date + coalesce(nullif(s.r->>'at', ''), '18:00')::time
             - make_interval(mins => coalesce((s.r->>'before')::int, 15)) as fire_at
    from s
  ), due as (
    select d.* from d
    where d.r->'days' ? d.dow
      and d.lt >= d.fire_at and d.lt < d.fire_at + interval '3 hours'
      and (d.last_sent is null or d.last_sent < d.lt::date)
      and not exists (
        select 1 from jsonb_array_elements(coalesce(d.sess, '[]'::jsonb)) x
        where (to_timestamp((x->>'date')::double precision / 1000) at time zone d.tz)::date = d.lt::date)
  ), upd as (
    update gt_push_subs p set last_sent = due.lt::date from due where p.endpoint = due.endpoint returning p.endpoint
  )
  select due.endpoint, due.sub,
         case when due.en then 'Today''s workout: ' else 'Séance du jour : ' end || (due.r->'days'->>due.dow),
         case when due.en then case when due.before > 0 then 'Starting in ' || due.before || ' min. Get ready!' else 'It''s time. Let''s go!' end
              when due.before > 0 then 'On commence dans ' || due.before || ' min. Prépare-toi !'
              else 'C''est l''heure. On y va ?' end
  from due join upd on upd.endpoint = due.endpoint;
$$;

-- Abonnements expirés (le téléphone a désinstallé l'app ou retiré l'autorisation).
create or replace function public.gt_push_gone(p_endpoints text[]) returns void
language sql security definer set search_path = public as $$
  delete from gt_push_subs where endpoint = any(p_endpoints);
$$;

revoke all on function public.gt_push_due(timestamptz), public.gt_push_gone(text[]) from public, anon, authenticated;
grant execute on function public.gt_push_subscribe(text, jsonb, text), public.gt_push_unsubscribe(text, text) to anon, authenticated;
