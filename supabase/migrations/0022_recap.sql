-- 0022 : récap de fin de partie visible par tous les joueurs du salon
-- get_game_recap(salon) : une fois la partie terminée, chaque joueur du salon (bots compris) reçoit
--   - players : bilan par joueur (jetons finaux, meurtres, Casino, cadeaux, Mairie, sabotages…),
--               exploits de la partie (trophées « de partie », recalculés ici, mode debug compris)
--               et trophées débloqués pour la première fois (comptes réels, hors debug) ;
--   - nights  : nuit par nuit, qui est allé où, les morts, les sabotages et les trucages ;
--   - votes   : résultat de chaque vote (déjà public).
-- Les votes individuels restent secrets (seuls les totaux et l'exploit « Fin limier » en découlent).
-- Les conditions des exploits doivent rester alignées sur record_game_stats (0017) et src/data/trophies.ts.

create or replace function public.get_game_recap(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room       public.rooms;
  v_casino_max int;
  v_nsab       int;
  v_alive_sab  int;
  v_game       uuid;
  v_players    jsonb := '[]'::jsonb;
  v_nights     jsonb;
  v_votes      jsonb;
  p            record;
  r            record;
  v_killed     int;
  v_elim       int;
  v_nights_n   int;
  v_streak     int;
  v_best       int;
  v_last       int;
  v_bets       int;
  v_net        int;
  v_jackpot    boolean;
  v_lose       int;
  v_lose_best  int;
  v_given      int;
  v_received   int;
  v_msucc      int;
  v_mfail      int;
  v_mkill      boolean;
  v_sabok      int;
  v_kills      int;
  v_ghost_ok   boolean;
  v_hints      int;
  v_feats      text[];
  v_new        text[];
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room_not_found'; end if;
  if not public.is_room_member(p_room_id) then raise exception 'not_member'; end if;
  if v_room.phase <> 'ended' then raise exception 'not_ended'; end if;

  v_casino_max := public.room_param(p_room_id, 'casino_max');
  select count(*) filter (where s.team = 'saboteurs'),
         count(*) filter (where s.team = 'saboteurs' and pl.is_alive)
  into v_nsab, v_alive_sab
  from public.players pl join public.player_secrets s on s.player_id = pl.id
  where pl.room_id = p_room_id;

  -- Partie enregistrée dans les statistiques (absente en mode debug)
  if not v_room.debug then
    select g.id into v_game from public.game_history g
    where g.room_id = p_room_id order by g.ended_at desc limit 1;
  end if;

  for p in
    select pl.id, pl.user_id, pl.is_alive, s.team, s.tokens
    from public.players pl join public.player_secrets s on s.player_id = pl.id
    where pl.room_id = p_room_id
    order by pl.joined_at
  loop
    select min(round) into v_killed from public.night_deaths where room_id = p_room_id and victim_id = p.id;
    select min(round) into v_elim   from public.vote_results where room_id = p_room_id and eliminated_id = p.id;
    select count(*) into v_nights_n from public.night_actions where room_id = p_room_id and player_id = p.id;

    -- Votes contre un Saboteur, manches consécutives (exploit « Fin limier » ; votes non renvoyés)
    v_streak := 0; v_best := 0; v_last := null;
    for r in
      select vo.round, ts.team as tteam
      from public.votes vo left join public.player_secrets ts on ts.player_id = vo.target_id
      where vo.room_id = p_room_id and vo.voter_id = p.id
      order by vo.round
    loop
      if v_last is not null and r.round <> v_last + 1 then v_streak := 0; end if;
      if r.tteam = 'saboteurs' then v_streak := v_streak + 1; v_best := greatest(v_best, v_streak);
      else v_streak := 0; end if;
      v_last := r.round;
    end loop;

    -- Casino (mises non nulles)
    v_bets := 0; v_net := 0; v_jackpot := false; v_lose := 0; v_lose_best := 0;
    for r in
      select (na.result->'casino'->>'stake')::int as stake, (na.result->'casino'->>'won')::boolean as won
      from public.night_actions na
      where na.room_id = p_room_id and na.player_id = p.id and na.result ? 'casino'
        and coalesce((na.result->'casino'->>'stake')::int, 0) > 0
      order by na.round
    loop
      v_bets := v_bets + 1;
      if r.won then
        v_net := v_net + r.stake; v_lose := 0;
        if r.stake >= v_casino_max then v_jackpot := true; end if;
      else
        v_net := v_net - r.stake; v_lose := v_lose + 1; v_lose_best := greatest(v_lose_best, v_lose);
      end if;
    end loop;

    select count(*) filter (where na.result->'don'->>'ok' = 'true'),
           coalesce(sum(public.try_int(na.result->>'gifts_received')), 0)
    into v_given, v_received
    from public.night_actions na where na.room_id = p_room_id and na.player_id = p.id;

    select count(*) into v_msucc from public.vote_tampering
    where room_id = p_room_id and player_id = p.id and kind in ('boost', 'shield');
    select count(*) into v_mfail from public.night_actions na
    where na.room_id = p_room_id and na.player_id = p.id
      and na.result->'mairie'->>'attempted' = 'true'
      and not exists (select 1 from public.vote_tampering vt
                      where vt.room_id = p_room_id and vt.round = na.round and vt.player_id = p.id
                        and vt.kind in ('boost', 'shield'));
    v_mkill := exists (
      select 1 from public.vote_tampering vt
      join public.vote_results vr on vr.room_id = vt.room_id and vr.round = vt.round
      where vt.room_id = p_room_id and vt.player_id = p.id and vt.kind = 'boost'
        and vr.eliminated_id = vt.target_id);

    select count(*) into v_sabok from public.night_actions na
    where na.room_id = p_room_id and na.player_id = p.id
      and na.result->'sabotage'->>'success' = 'true'
      and coalesce(na.result->'sabotage'->>'shared', 'false') <> 'true';

    v_kills := 0;
    if p.team = 'saboteurs' then
      select count(*) into v_kills
      from public.night_deaths d
      join public.night_actions na on na.room_id = d.room_id and na.round = d.round
                                  and na.location = d.location and na.player_id = p.id
      where d.room_id = p_room_id;
    end if;

    v_ghost_ok := null;
    if not p.is_alive then
      select gs.team = 'saboteurs' into v_ghost_ok
      from public.ghost_hints h join public.player_secrets gs on gs.player_id = h.suspect_id
      where h.player_id = p.id;
    end if;

    select count(*) into v_hints
    from public.night_actions na
    cross join lateral jsonb_array_elements(coalesce(na.result->'cimetiere'->'spirits', '[]'::jsonb)) sp
    join public.player_secrets ss on ss.player_id = public.try_uuid(sp->>'suspect_id')
    where na.room_id = p_room_id and na.player_id = p.id and ss.team = 'saboteurs';

    v_feats := array_remove(array[
      case when v_killed = 1 then 'mauvais_endroit' end,
      case when v_elim is not null and p.team <> 'saboteurs' then 'bouc_emissaire' end,
      case when v_best >= 3 then 'fin_limier' end,
      case when p.team = 'saboteurs' and v_room.winner = 'saboteurs' and p.is_alive and v_nsab >= 2 and v_alive_sab = 1
           then 'loup_solitaire' end,
      case when v_kills >= 3 then 'massacre' end,
      case when v_jackpot then 'jackpot' end,
      case when v_lose_best >= 3 then 'ruine' end,
      case when v_mkill then 'maire_vereux' end,
      case when v_mfail > 0 then 'main_dans_le_sac' end,
      case when v_hints > 0 then 'medium' end,
      case when v_ghost_ok and p.team <> 'saboteurs' then 'fantome_rancunier' end
    ], null);

    v_new := '{}';
    if v_game is not null and p.user_id is not null then
      select coalesce(array_agg(t.trophy_id order by t.unlocked_at), '{}') into v_new
      from public.player_trophies t where t.user_id = p.user_id and t.game_id = v_game;
    end if;

    v_players := v_players || jsonb_build_object(
      'player_id', p.id,
      'tokens', p.tokens,
      'killed_round', v_killed,
      'eliminated_round', v_elim,
      'nights', v_nights_n,
      'kills', v_kills,
      'casino_bets', v_bets,
      'casino_net', v_net,
      'gifts_given', v_given,
      'gifts_received', v_received,
      'mairie_ok', v_msucc,
      'mairie_fail', v_mfail,
      'sabotages', v_sabok,
      'feats', to_jsonb(v_feats),
      'new_trophies', to_jsonb(v_new));
  end loop;

  -- Nuit par nuit : déplacements, morts, sabotages, trucages
  select coalesce(jsonb_agg(n order by (n->>'round')::int), '[]'::jsonb) into v_nights
  from (
    select jsonb_build_object(
      'round', rd.round,
      'moves', coalesce((select jsonb_agg(jsonb_build_object('player_id', na.player_id, 'location', na.location)
                                          order by na.location, na.player_id)
                         from public.night_actions na where na.room_id = p_room_id and na.round = rd.round), '[]'::jsonb),
      'deaths', coalesce((select jsonb_agg(jsonb_build_object('player_id', d.victim_id, 'location', d.location))
                          from public.night_deaths d where d.room_id = p_room_id and d.round = rd.round), '[]'::jsonb),
      'sabotages', coalesce((select jsonb_agg(jsonb_build_object(
                                      'player_id', na.player_id,
                                      'location', na.result->'sabotage'->>'location',
                                      'success', (na.result->'sabotage'->>'success')::boolean))
                             from public.night_actions na
                             where na.room_id = p_room_id and na.round = rd.round and na.result ? 'sabotage'), '[]'::jsonb),
      'rigs', coalesce((select jsonb_agg(jsonb_build_object('player_id', vt.player_id, 'kind', vt.kind, 'target_id', vt.target_id))
                        from public.vote_tampering vt where vt.room_id = p_room_id and vt.round = rd.round), '[]'::jsonb)
    ) as n
    from (select distinct round from public.night_actions where room_id = p_room_id) rd
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
           'round', vr.round, 'eliminated_id', vr.eliminated_id, 'eliminated_team', vr.eliminated_team,
           'tally', vr.tally, 'tied', vr.tied, 'runoffs', vr.runoffs, 'drawn', vr.drawn) order by vr.round), '[]'::jsonb)
  into v_votes
  from public.vote_results vr where vr.room_id = p_room_id;

  return jsonb_build_object('players', v_players, 'nights', v_nights, 'votes', v_votes);
end $$;

revoke all on function public.get_game_recap(uuid) from public, anon;
grant execute on function public.get_game_recap(uuid) to authenticated;
