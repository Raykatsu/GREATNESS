-- GREATNESS : notifications de la ligue entre amis (Web Push). À lancer après 005_social_push.sql
-- (fait automatiquement par le déploiement GitHub). Relançable sans risque.
-- Chacun publie dans son résumé public sa ligue : public->'league' = { s (saison), end (fin, ms), div, pts,
-- last: { s, pts } } (voir js/league.js). La fonction « reminders », appelée toutes les 15 min, envoie aussi :
--   · un ami te passe devant au classement de la saison (une fois par ami et par saison) ;
--   · le dernier jour de la saison (dès 17 h), si tu es dans la zone de descente sans le maintien assuré
--     (160 points), ou juste derrière la zone de montée.
-- Mêmes règles que les défis : jamais la nuit (9 h – 21 h 30), une à la fois, 3 par jour au plus (avec les défis).

-- Points d'un résumé public pour la saison p_season (saison en cours, ou celle d'avant si l'ami a déjà changé)
create or replace function public.gt_league_pts(p jsonb, p_season int) returns numeric
language sql immutable set search_path = public as $$
  select coalesce(case
    when (p->'league'->>'s')::int = p_season then (p->'league'->>'pts')::numeric
    when (p->'league'->>'s')::int = p_season + 1 and (p->'league'->'last'->>'s')::int = p_season then (p->'league'->'last'->>'pts')::numeric
  end, 0);
$$;

create or replace function public.gt_push_league(p_now timestamptz default now())
returns table(endpoint text, sub jsonb, title text, body text)
language plpgsql security definer set search_path = public as $$
declare
  u record; f record;
  lt timestamp; s int; left_ms double precision;
  myp numeric; fp numeric; n int; rnk int; zone int; nextp numeric; nextname text;
  t text; b text; k text;
begin
  for u in
    select a.username, a.public as p, min(ps.tz) as tz
      from gt_accounts a join gt_push_subs ps on ps.username = a.username
     where a.public ? 'league'
     group by a.username, a.public
  loop
    lt := p_now at time zone u.tz;
    continue when lt::time < time '09:00' or lt::time > time '21:30';
    continue when (select count(*) from gt_social_sent x where x.username = u.username and x.key like 'n:%' and x.at > p_now - interval '24 hours') >= 3;
    s := (u.p->'league'->>'s')::int;
    left_ms := coalesce((u.p->'league'->>'end')::double precision, 0) - extract(epoch from p_now) * 1000;
    continue when left_ms <= 0; -- résumé d'une saison déjà finie : l'app réglera la saison à sa prochaine ouverture
    myp := gt_league_pts(u.p, s);
    t := null;
    -- 1. un ami passe devant au classement de la saison (une fois par ami et par saison)
    for f in
      select x.friend, acc.public as fp, coalesce(acc.public->>'name', x.friend) as fname
        from (select case when g.a = u.username then g.b else g.a end as friend
                from gt_friends g where (g.a = u.username or g.b = u.username) and g.status = 'accepted') x
        join gt_accounts acc on acc.username = x.friend
    loop
      fp := gt_league_pts(f.fp, s);
      if myp > fp and myp > 0 then
        insert into gt_social_sent(username, key, at) values (u.username, 'lg-ahead:' || f.friend || ':' || s, p_now) on conflict do nothing;
      elsif fp > myp
         and exists (select 1 from gt_social_sent x where x.username = u.username and x.key = 'lg-ahead:' || f.friend || ':' || s)
         and not exists (select 1 from gt_social_sent x where x.username = u.username and x.key = 'lg-over:' || f.friend || ':' || s) then
        k := 'lg-over:' || f.friend || ':' || s;
        t := '🎖️ ' || f.fname || ' te passe devant en ligue';
        b := f.fname || ' : ' || fp::int || ' pts cette saison, toi ' || myp::int || ' pts. Une séance pour reprendre ta place ?';
        exit;
      end if;
    end loop;
    -- 2. dernier jour de la saison
    if t is null and left_ms < 86400000 and lt::time >= time '17:00'
       and not exists (select 1 from gt_social_sent x where x.username = u.username and x.key = 'lg-end:' || s) then
      with fr as (
        select coalesce(acc.public->>'name', x.friend) as fname, gt_league_pts(acc.public, s) as pts
          from (select case when g.a = u.username then g.b else g.a end as friend
                  from gt_friends g where (g.a = u.username or g.b = u.username) and g.status = 'accepted') x
          join gt_accounts acc on acc.username = x.friend
      )
      select count(*) + 1, count(*) filter (where fr.pts > myp) + 1 into n, rnk from fr;
      zone := greatest(1, round(n / 3.0));
      if n >= 3 and rnk > n - zone and myp < 160 then
        k := 'lg-end:' || s;
        t := '⏳ Dernier jour de la saison';
        b := 'Tu es en zone de descente : ' || (160 - myp)::int || ' pts pour assurer ton maintien. Une séance ce soir ?';
      elsif n >= 3 and rnk = zone + 1 then
        with fr as (
          select coalesce(acc.public->>'name', x.friend) as fname, gt_league_pts(acc.public, s) as pts
            from (select case when g.a = u.username then g.b else g.a end as friend
                    from gt_friends g where (g.a = u.username or g.b = u.username) and g.status = 'accepted') x
            join gt_accounts acc on acc.username = x.friend
        )
        select fr.pts, fr.fname into nextp, nextname from fr order by fr.pts desc offset zone - 1 limit 1;
        k := 'lg-end:' || s;
        t := '⏳ Dernier jour de la saison';
        b := 'Plus que ' || (nextp - myp + 1)::int || ' pts pour passer devant ' || nextname || ' et monter de division !';
      end if;
    end if;
    if t is not null then
      insert into gt_social_sent(username, key, at) values (u.username, k, p_now), (u.username, 'n:' || k, p_now) on conflict do nothing;
      return query select ps.endpoint, ps.sub, t, b from gt_push_subs ps where ps.username = u.username;
    end if;
  end loop;
end $$;

revoke all on function public.gt_push_league(timestamptz), public.gt_league_pts(jsonb, int) from public, anon, authenticated;
