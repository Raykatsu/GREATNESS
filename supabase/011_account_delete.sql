-- GREATNESS : suppression définitive d'un compte en ligne depuis l'app (exigée par l'App Store, et ton droit selon
-- le RGPD). Il faut le jeton de connexion ET le code : tout est effacé (données, amis, notifications, mesures
-- Apple Santé, alertes…). À lancer après schema.sql (fait automatiquement par le déploiement GitHub). Relançable.
create or replace function public.gt_delete_account(p_token text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := gt_user(p_token); a gt_accounts%rowtype;
begin
  if u is null then return json_build_object('error', 'BAD_TOKEN'); end if;
  select * into a from gt_accounts where username = u for update;
  if a.locked_until is not null and a.locked_until > now() then return json_build_object('error', 'LOCKED'); end if;
  if crypt(coalesce(p_pin, ''), a.pin_hash) <> a.pin_hash then
    update gt_accounts set failed = a.failed + 1,
      locked_until = case when a.failed + 1 >= 5 then now() + interval '15 minutes' else null end where username = u;
    return json_build_object('error', case when a.failed + 1 >= 5 then 'LOCKED' else 'BAD_PIN' end);
  end if;
  delete from gt_accounts where username = u; -- les autres tables suivent (on delete cascade)
  return json_build_object('ok', true);
end $$;
grant execute on function public.gt_delete_account(text, text) to anon;
