-- GREATNESS : notifications des défis entre amis (Web Push). À lancer après 003_push.sql
-- (fait automatiquement par le déploiement GitHub). Relançable sans risque.
-- La fonction « reminders », appelée toutes les 15 min, envoie aussi ces notifications :
--   · un ami te défie en duel ;
--   · un ami te dépasse au classement de la semaine (une fois par ami et par semaine) ;
--   · dimanche dès 18 h, si tu es derrière dans un duel : dernières heures pour repasser devant.
-- Jamais la nuit (9 h – 21 h 30, heure du téléphone), une à la fois, 3 par jour au maximum.

create table if not exists public.gt_social_sent (
  username text not null references public.gt_accounts(username) on delete cascade,
  key      text not null,
  at       timestamptz not null default now(),
  primary key (username, key)
);
alter table public.gt_social_sent enable row level security;
revoke all on public.gt_social_sent from anon, authenticated;

-- Valeur d'une épreuve (volume, séances, minutes, records) pour la semaine qui commence à p_start (ms)
create or replace function public.gt_week_val(p jsonb, p_start double precision, p_metric text) returns numeric
language sql immutable set search_path = public as $$
  select coalesce(case
    when abs(coalesce((p->'week'->>'start')::double precision, 0) - p_start) < 172800000 then (p->'week'->>p_metric)::numeric
    when abs(coalesce((p->'last'->>'start')::double precision, 0) - p_start) < 172800000 then (p->'last'->>p_metric)::numeric
  end, 0);
$$;

create or replace function public.gt_push_social(p_now timestamptz default now())
returns table(endpoint text, sub jsonb, title text, body text)
language plpgsql security definer set search_path = public as $$
declare
  u record; f record; d jsonb;
  lt timestamp; ws double precision; wk text;
  myv numeric; fv numeric; t text; b text; k text;
begin
  delete from gt_social_sent where at < p_now - interval '21 days';
  for u in
    select a.username, a.public as p, coalesce(a.data->'duels', '[]'::jsonb) as duels, min(ps.tz) as tz
      from gt_accounts a join gt_push_subs ps on ps.username = a.username
     group by a.username, a.public, a.data->'duels'
  loop
    lt := p_now at time zone u.tz;
    continue when lt::time < time '09:00' or lt::time > time '21:30';
    continue when (select count(*) from gt_social_sent s where s.username = u.username and s.key like 'n:%' and s.at > p_now - interval '24 hours') >= 3;
    ws := extract(epoch from (date_trunc('week', lt) at time zone u.tz)) * 1000;
    wk := to_char(date_trunc('week', lt), 'IYYY-IW');
    t := null;
    for f in
      select x.friend, acc.public as fp, coalesce(acc.public->>'name', x.friend) as fname
        from (select case when g.a = u.username then g.b else g.a end as friend
                from gt_friends g where (g.a = u.username or g.b = u.username) and g.status = 'accepted') x
        join gt_accounts acc on acc.username = x.friend
    loop
      -- 1. invitation à un duel (pas encore relevé)
      select e into d from jsonb_array_elements(coalesce(f.fp->'duels', '[]'::jsonb)) e
       where e->>'u' = u.username and abs((e->>'w')::double precision - ws) < 172800000 limit 1;
      if d is not null
         and not exists (select 1 from jsonb_array_elements(u.duels) m where m->>'u' = f.friend and abs((m->>'w')::double precision - ws) < 172800000)
         and not exists (select 1 from gt_social_sent s where s.username = u.username and s.key = 'inv:' || f.friend || ':' || wk) then
        k := 'inv:' || f.friend || ':' || wk;
        t := '⚔️ ' || f.fname || ' te défie en duel';
        b := 'Épreuve : ' || case d->>'m' when 'count' then 'nombre de séances' when 'minutes' then 'temps d''entraînement' when 'prs' then 'records battus' else 'volume soulevé' end
             || ' jusqu''à dimanche. Ouvre GREATNESS pour relever le défi !';
        exit;
      end if;
      -- 2. dépassé au classement (volume de la semaine), une fois par ami et par semaine
      myv := gt_week_val(u.p, ws, 'volume');
      fv := gt_week_val(f.fp, ws, 'volume');
      if myv > fv and myv > 0 then
        insert into gt_social_sent(username, key, at) values (u.username, 'ahead:' || f.friend || ':' || wk, p_now) on conflict do nothing;
      elsif fv > myv
         and exists (select 1 from gt_social_sent s where s.username = u.username and s.key = 'ahead:' || f.friend || ':' || wk)
         and not exists (select 1 from gt_social_sent s where s.username = u.username and s.key = 'over:' || f.friend || ':' || wk) then
        k := 'over:' || f.friend || ':' || wk;
        t := '⚡ ' || f.fname || ' t''a dépassé';
        b := f.fname || ' : ' || replace(to_char(fv, 'FM999,999,999'), ',', ' ') || ' kg cette semaine, toi ' || replace(to_char(myv, 'FM999,999,999'), ',', ' ') || ' kg. À toi de jouer !';
        exit;
      end if;
      -- 3. dimanche soir : dernières heures d'un duel où l'on est derrière
      if extract(isodow from lt) = 7 and lt::time >= time '18:00' then
        select m into d from jsonb_array_elements(u.duels) m
         where m->>'u' = f.friend and abs((m->>'w')::double precision - ws) < 172800000
           and exists (select 1 from jsonb_array_elements(coalesce(f.fp->'duels', '[]'::jsonb)) e where e->>'u' = u.username and abs((e->>'w')::double precision - ws) < 172800000)
         limit 1;
        if d is not null and gt_week_val(f.fp, ws, d->>'m') > gt_week_val(u.p, ws, d->>'m')
           and not exists (select 1 from gt_social_sent s where s.username = u.username and s.key = 'end:' || f.friend || ':' || wk) then
          k := 'end:' || f.friend || ':' || wk;
          t := '⏳ Dernières heures du duel';
          b := f.fname || ' mène encore. Une dernière séance ce soir pour repasser devant ?';
          exit;
        end if;
      end if;
    end loop;
    if t is not null then
      insert into gt_social_sent(username, key, at) values (u.username, k, p_now), (u.username, 'n:' || k, p_now) on conflict do nothing;
      return query select ps.endpoint, ps.sub, t, b from gt_push_subs ps where ps.username = u.username;
    end if;
  end loop;
end $$;

revoke all on function public.gt_push_social(timestamptz), public.gt_week_val(jsonb, double precision, text) from public, anon, authenticated;
