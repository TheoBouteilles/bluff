-- 0020 : robustesse et hygiène des droits (revue de sécurité du 14 nov.)
-- Revue : aucune RPC ne laisse lire le rôle, le vote ou l'action d'un autre joueur ; les fonctions internes
-- (meurtres, jetons, résolution) ne sont pas appelables par les clients ; « agir pour un bot » est réservé
-- à l'hôte d'un salon debug. Corrections ci-dessous.

-- 1. Droits de table superflus : les clients ne lisent qu'en SELECT (RLS) et n'écrivent que par RPC.
--    TRUNCATE contourne la RLS : on le retire partout (il n'est pas exposé par l'API, mais autant fermer).
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke insert, update, delete on public.game_history, public.player_game_stats, public.player_trophies
  from anon, authenticated;
revoke select on public.game_history, public.player_game_stats, public.player_trophies from anon;

-- 2. remove_bot : seulement dans le salon d'attente (sinon un bot disparaîtrait en pleine partie)
create or replace function public.remove_bot(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot public.players;
begin
  select * into v_bot from public.players where id = p_player_id and is_bot;
  if not found then return; end if;
  if not exists (select 1 from public.players where room_id = v_bot.room_id and user_id = auth.uid() and is_host) then
    raise exception 'not_host';
  end if;
  if (select status from public.rooms where id = v_bot.room_id) <> 'lobby' then
    raise exception 'game_started';
  end if;
  delete from public.players where id = p_player_id;
end $$;

-- 3. Hôte absent : 60 s sans signe de vie (au lieu de 25 s). Un téléphone en veille quelques secondes pendant
--    le débat ne fait plus perdre la main à l'hôte ; un hôte vraiment parti est remplacé en une minute.
create or replace function public.claim_host(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_me        public.players;
  v_host      public.players;
  v_host_seen timestamptz;
begin
  perform 1 from public.rooms where id = p_room_id for update;
  if not found then return false; end if;

  select * into v_me from public.players where room_id = p_room_id and user_id = v_uid;
  if not found then return false; end if;

  select * into v_host from public.players where room_id = p_room_id and is_host;
  if not found then
    update public.players set is_host = true where id = v_me.id;
    return true;
  end if;
  if v_host.id = v_me.id then return false; end if;

  select last_seen into v_host_seen from public.player_heartbeats where player_id = v_host.id;
  if v_host_seen is not null and v_host_seen > now() - interval '60 seconds' then return false; end if;

  update public.players set is_host = false where id = v_host.id;
  update public.players set is_host = true where id = v_me.id;
  return true;
end $$;
