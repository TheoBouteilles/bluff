-- 0021 : comptes optionnels, profils (pseudo, avatar personnalisé, préférences) et fusion invité → compte
--
-- Tout joueur a un identifiant Supabase (session anonyme « invité » ou compte e-mail / Google).
-- Le profil est rattaché à cet identifiant : un invité peut déjà le régler, un compte le retrouve partout.
-- Connexion depuis un appareil où l'on jouait en invité : l'invité crée un « ticket » secret à usage unique
-- (create_merge_ticket) juste avant de se connecter ; une fois connecté, claim_merge_ticket rapatrie sur le
-- compte ses statistiques, trophées, profil et sa place dans les salons en cours. Seules les données d'un
-- invité (compte anonyme) peuvent être rapatriées.

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nickname   text check (nickname is null or char_length(nickname) between 1 and 20),
  avatar     smallint check (avatar is null or avatar between 0 and 9),
  look       jsonb not null default '{}'::jsonb, -- {"t": tenue 0-7, "a": accessoire 0-6}
  prefs      jsonb not null default '{}'::jsonb, -- préférences (son…), libres côté app
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security; -- aucune policy : lecture et écriture par RPC

alter table public.players add column if not exists look jsonb not null default '{}'::jsonb;

-- Apparence valide : {"t": 0..7, "a": 0..6}, rien d'autre
create or replace function public.clean_look(p_look jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    't', greatest(0, least(7, coalesce(public.try_int(p_look->>'t'), 0))),
    'a', greatest(0, least(6, coalesce(public.try_int(p_look->>'a'), 0))));
$$;

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p   public.profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_p from public.profiles where user_id = v_uid;
  return jsonb_build_object(
    'nickname', v_p.nickname,
    'avatar', v_p.avatar,
    'look', coalesce(v_p.look, '{}'::jsonb),
    'prefs', coalesce(v_p.prefs, '{}'::jsonb));
end $$;

-- Enregistre le profil (null = inchangé). Met aussi à jour l'avatar dans les salons d'attente en cours.
create or replace function public.save_my_profile(
  p_nickname text default null, p_avatar int default null, p_look jsonb default null, p_prefs jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_nick text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_nick is not null and char_length(v_nick) > 20 then raise exception 'invalid_nickname'; end if;
  if p_avatar is not null and (p_avatar < 0 or p_avatar > 9) then raise exception 'invalid_params'; end if;
  if p_prefs is not null and (jsonb_typeof(p_prefs) <> 'object' or length(p_prefs::text) > 4000) then
    raise exception 'invalid_params';
  end if;

  insert into public.profiles (user_id, nickname, avatar, look, prefs)
  values (v_uid, v_nick, p_avatar, coalesce(public.clean_look(p_look), '{}'::jsonb), coalesce(p_prefs, '{}'::jsonb))
  on conflict (user_id) do update set
    nickname   = coalesce(v_nick, public.profiles.nickname),
    avatar     = coalesce(p_avatar::smallint, public.profiles.avatar),
    look       = case when p_look is null then public.profiles.look else public.clean_look(p_look) end,
    prefs      = coalesce(p_prefs, public.profiles.prefs),
    updated_at = now();

  -- Salons d'attente : l'apparence suit le profil (le pseudo de salon, lui, reste celui choisi en entrant)
  update public.players pl
  set avatar = coalesce(p_avatar::smallint, pl.avatar),
      look   = case when p_look is null then pl.look else public.clean_look(p_look) end
  from public.rooms r
  where r.id = pl.room_id and r.status = 'lobby' and pl.user_id = v_uid;

  return public.get_my_profile();
end $$;

-- En entrant dans un salon (create_room / join_room), le joueur prend l'avatar et l'apparence de son profil
create or replace function public.trg_players_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.profiles;
begin
  if new.user_id is not null then
    select * into v_p from public.profiles where user_id = new.user_id;
    if found then
      new.avatar := coalesce(v_p.avatar, new.avatar);
      new.look := coalesce(v_p.look, '{}'::jsonb);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists players_profile on public.players;
create trigger players_profile
before insert on public.players
for each row execute function public.trg_players_profile();

-- ---------------------------------------------------------------------------
-- Fusion invité → compte
-- ---------------------------------------------------------------------------
create table if not exists public.merge_tickets (
  ticket     text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 minutes'
);
alter table public.merge_tickets enable row level security; -- aucune policy

create or replace function public.create_merge_ticket()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_ticket text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not coalesce((select is_anonymous from auth.users where id = v_uid), false) then return null; end if;
  delete from public.merge_tickets where user_id = v_uid or expires_at < now();
  insert into public.merge_tickets (ticket, user_id) values (v_ticket, v_uid);
  return v_ticket;
end $$;

create or replace function public.claim_merge_ticket(p_ticket text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_old   uuid;
  v_games int := 0;
  v_seats int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  delete from public.merge_tickets where ticket = p_ticket and expires_at > now() returning user_id into v_old;
  if v_old is null or v_old = v_uid then return jsonb_build_object('merged', false); end if;
  if not coalesce((select is_anonymous from auth.users where id = v_old), false) then
    return jsonb_build_object('merged', false);
  end if;

  -- Statistiques (une partie déjà présente sur le compte n'est pas dupliquée)
  update public.player_game_stats s set user_id = v_uid
  where s.user_id = v_old
    and not exists (select 1 from public.player_game_stats x where x.game_id = s.game_id and x.user_id = v_uid);
  get diagnostics v_games = row_count;
  delete from public.player_game_stats where user_id = v_old;

  insert into public.player_trophies (user_id, trophy_id, game_id, unlocked_at)
  select v_uid, trophy_id, game_id, unlocked_at from public.player_trophies where user_id = v_old
  on conflict (user_id, trophy_id) do nothing;
  delete from public.player_trophies where user_id = v_old;

  -- Profil : celui du compte prime ; à défaut, celui de l'invité
  insert into public.profiles (user_id, nickname, avatar, look, prefs)
  select v_uid, nickname, avatar, look, prefs from public.profiles where user_id = v_old
  on conflict (user_id) do update set
    nickname = coalesce(public.profiles.nickname, excluded.nickname),
    avatar   = coalesce(public.profiles.avatar, excluded.avatar),
    look     = case when public.profiles.look = '{}'::jsonb then excluded.look else public.profiles.look end,
    prefs    = case when public.profiles.prefs = '{}'::jsonb then excluded.prefs else public.profiles.prefs end;
  delete from public.profiles where user_id = v_old;

  -- Places dans les salons (en cours ou non), sauf si le compte y est déjà
  update public.players p set user_id = v_uid
  where p.user_id = v_old
    and not exists (select 1 from public.players x where x.room_id = p.room_id and x.user_id = v_uid);
  get diagnostics v_seats = row_count;

  return jsonb_build_object('merged', true, 'games', v_games, 'seats', v_seats);
end $$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.merge_tickets from anon, authenticated;
revoke all on function public.trg_players_profile() from public, anon, authenticated;
revoke all on function public.clean_look(jsonb) from public, anon, authenticated;
revoke execute on function public.get_my_profile() from public, anon;
revoke execute on function public.save_my_profile(text, int, jsonb, jsonb) from public, anon;
revoke execute on function public.create_merge_ticket() from public, anon;
revoke execute on function public.claim_merge_ticket(text) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.save_my_profile(text, int, jsonb, jsonb) to authenticated;
grant execute on function public.create_merge_ticket() to authenticated;
grant execute on function public.claim_merge_ticket(text) to authenticated;
