-- GREATNESS : état des modèles Gemini, partagé entre toutes les instances de la fonction « coach ». À lancer après
-- 004_ai.sql (fait automatiquement par le déploiement GitHub). Relançable sans risque.
-- Un modèle trop lent ou saturé chez Google est essayé en dernier pendant 5 min, puis 10, 20, 40, jusqu'à 1 h s'il
-- reste en panne ; dès qu'il répond à nouveau, il reprend sa place. La recherche Google dont le quota est épuisé
-- est sautée 30 min. Sans ce partage, chaque instance réapprenait seule (7 s perdues sur un modèle saturé).

create table if not exists public.gt_ai_models (
  model        text primary key,
  slow_until   timestamptz,
  search_until timestamptz,
  fails        int not null default 0,
  ok_ms        int,
  at           timestamptz not null default now()
);
alter table public.gt_ai_models enable row level security;
revoke all on public.gt_ai_models from anon, authenticated;

-- Les modèles à éviter en ce moment : { modèle: { slow: fin (ms), search: fin (ms) } }
create or replace function public.gt_ai_models_get() returns json
language sql security definer set search_path = public as $$
  select coalesce(json_object_agg(model, json_build_object(
    'slow', case when slow_until > now() then (extract(epoch from slow_until) * 1000)::bigint end,
    'search', case when search_until > now() then (extract(epoch from search_until) * 1000)::bigint end)), '{}'::json)
  from gt_ai_models where slow_until > now() or search_until > now();
$$;

-- p_kind : slow (lent, saturé, muet), search (quota de recherche épuisé), ok (il répond à nouveau)
create or replace function public.gt_ai_models_mark(p_model text, p_kind text, p_ms int default 0) returns json
language plpgsql security definer set search_path = public as $$
declare m text := left(coalesce(p_model, ''), 80);
begin
  if m = '' then return json_build_object('error', 'NO_MODEL'); end if;
  insert into gt_ai_models(model) values (m) on conflict (model) do nothing;
  if p_kind = 'slow' then
    update gt_ai_models set slow_until = now() + make_interval(mins => least(60, 5 * power(2, least(fails, 4)))::int),
      fails = fails + 1, at = now() where model = m;
  elsif p_kind = 'search' then
    update gt_ai_models set search_until = now() + interval '30 minutes', at = now() where model = m;
  elsif p_kind = 'ok' then
    update gt_ai_models set slow_until = null, fails = 0, ok_ms = greatest(0, coalesce(p_ms, 0)), at = now() where model = m;
  else
    return json_build_object('error', 'BAD_KIND');
  end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.gt_ai_models_get(), public.gt_ai_models_mark(text, text, int) from public, anon, authenticated;
