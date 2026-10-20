-- GREATNESS : rappels pour boire (Web Push). À lancer après 003_push.sql (fait automatiquement par le
-- déploiement GitHub). Relançable sans risque.
-- La fonction « reminders », appelée toutes les 15 min, les envoie : seulement dans la plage choisie (jamais la nuit),
-- si l'on est en retard sur le rythme de son objectif d'eau (+ 0,5 L un jour d'entraînement), au plus une fois toutes
-- les « every » heures, et plus du tout une fois l'objectif atteint. Réglages : data->'reminders'->'water' (app).

alter table public.gt_push_subs add column if not exists water_sent timestamptz;

-- 0,75 → « 0,75 » ; 2 → « 2 »
create or replace function public.gt_litres(p numeric) returns text
language sql immutable set search_path = public as $$
  select replace(rtrim(rtrim(to_char(p, 'FM9990.00'), '0'), '.'), '.', ',');
$$;

create or replace function public.gt_push_water(p_now timestamptz default now())
returns table(endpoint text, sub jsonb, title text, body text)
language sql security definer set search_path = public as $$
  with s as (
    select ps.endpoint, ps.sub, ps.tz, ps.water_sent, a.data as d, a.data->'reminders'->'water' as w,
           (p_now at time zone ps.tz) as lt, coalesce(a.data->'profile'->>'lang', 'fr') = 'en' as en
    from gt_push_subs ps join gt_accounts a on a.username = ps.username
    where a.data->'reminders' ? 'water'
  ), v as (
    select s.*,
      coalesce(nullif(s.w->>'from', ''), '09:00')::time as t_from,
      coalesce(nullif(s.w->>'to', ''), '21:00')::time as t_to,
      greatest(1, least(6, coalesce((s.w->>'every')::numeric, 2))) as every,
      greatest(1, least(24, round(coalesce((s.w->>'goal')::numeric, 8))::int))
        + case when exists (select 1 from jsonb_array_elements(coalesce(s.d->'sessions', '[]'::jsonb)) x
                            where (to_timestamp((x->>'date')::double precision / 1000) at time zone s.tz)::date = s.lt::date)
               then 2 else 0 end as goal,
      round(coalesce((s.d->'food'->to_char(s.lt, 'YYYY-MM-DD')->>'water')::numeric, 0))::int as n
    from s
  ), due as (
    select v.* from v
    where v.t_to > v.t_from and v.lt::time between v.t_from and v.t_to
      and (v.water_sent is null or p_now - v.water_sent >= make_interval(mins => (v.every * 60)::int))
      and v.n < v.goal
      and v.n < floor(v.goal * extract(epoch from (v.lt::time - v.t_from)) / extract(epoch from (v.t_to - v.t_from)))
  ), upd as (
    update gt_push_subs p set water_sent = p_now from due where p.endpoint = due.endpoint returning p.endpoint
  )
  select due.endpoint, due.sub,
         case when due.en then 'Time to drink 💧' else 'Pense à boire 💧' end,
         case when due.en then 'You''re at ' || replace(gt_litres(due.n * 0.25), ',', '.') || ' L of ' || replace(gt_litres(due.goal * 0.25), ',', '.') || ' L today. A big glass?'
              else 'Tu en es à ' || gt_litres(due.n * 0.25) || ' L sur ' || gt_litres(due.goal * 0.25) || ' L aujourd''hui. Un grand verre ?' end
  from due join upd on upd.endpoint = due.endpoint;
$$;

revoke all on function public.gt_push_water(timestamptz) from public, anon, authenticated;
