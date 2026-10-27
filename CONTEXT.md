# BLUFF : contexte du projet

Jeu de société mobile (Web App) à rôles cachés, 4 à 10 joueurs, en présentiel, entre amis.
Stack 100 % gratuite : React + TypeScript + Tailwind (Vite), Supabase (Postgres + Realtime + auth anonyme), Vercel.
Dépôt GitHub privé. Pas de Claude Code : le code est fourni par fichiers complets à copier dans VS Code.

## Règles de jeu validées
- Salon avec code de 4 lettres (alphabet sans voyelles) + lien direct. Pseudo + session anonyme, reconnexion possible.
- Min 4, max 10 joueurs. Impossible de rejoindre une partie lancée.
- L'hôte est un joueur normal, sans pouvoir spécial. S'il disparaît (> 25 s sans heartbeat), un autre joueur devient hôte.
- Tour : Nuit (actions secrètes avec jetons) > Jour (débat oral) > Vote > Élimination > tour suivant.
- L'élimination révèle l'équipe, pas forcément le rôle exact. Éliminés = spectateurs (actions possibles en v2).
- Jetons de départ : 2 pour les Saboteurs, 1 pour les autres.
- 11 rôles (tableur Drive "Rôles") : 5 Villageois (Mécène, Enquêteur, Garde du Corps, Juge intègre, Témoin aveugle), 4 Saboteurs (Saboteur de l'ombre, Corrupteur, Caméléon, Intercepteur), 2 Solitaires (Capitaliste, Opportuniste).
- Distribution de test (à rééquilibrer) : 4j=1S/3V ; 5j=1S/4V ; 6j=2S/3V/1Sol ; 7j=2S/3V/2Sol ; 8j=2S/4V/2Sol ; 9j=3S/4V/2Sol ; 10j=3S/5V/2Sol.
- Règle de dépendance : si l'Intercepteur est tiré, le Mécène l'est aussi.
- Solitaire : 1 à partir de 6 joueurs, 2 à partir de 7.

## Architecture
- Les rôles vivent en dur dans src/data/roles.ts. La base ne stocke que role_id (texte).
- Le client n'écrit jamais directement en base : tout passe par des fonctions SQL (RPC) security definer.
- RLS : on lit rooms/players de son salon ; player_secrets uniquement sa propre ligne.
- Présence (heartbeat) dans player_heartbeats, hors publication Realtime (évite le flot d'événements).
- Realtime : tables rooms et players. Sur tout événement, recharger la liste (les DELETE ne sont pas filtrés par RLS).
- Mode debug : option à la création du salon ; l'hôte ajoute/supprime des bots (add_bot/remove_bot). Prévu en phase 2 : "voir en tant que" + lecture des secrets des bots.
- avatar = index 0 à 9 (couleur + emoji), palette définie côté app.

## Fonctions SQL (phase 1)
create_room(pseudo, debug) | join_room(code, pseudo) | leave_room(room_id) | heartbeat(room_id) |
claim_host(room_id) | start_game(room_id) | add_bot(room_id) | remove_bot(player_id) | cleanup_inactive_rooms()
Codes d'erreur : not_authenticated, invalid_nickname, room_not_found, game_started, room_full,
nickname_taken, not_host, not_enough_players, debug_disabled.

## Écrans de la phase 1
Accueil (Créer / Rejoindre / Liste des rôles) > Création > Rejoindre > Salon d'attente > Liste des rôles > Écran "Partie lancée" (provisoire).

## Feuille de route
- Phase 0 : setup. FAIT (Vite, Tailwind, Supabase auth anonyme, Vercel).
- Phase 1 : salon et accueil + mode debug. EN COURS (SQL à exécuter, puis écrans).
- Phase 2 : distribution des rôles, révélation (maintien pour révéler).
- Phase 3 : nuit (jetons, pouvoirs).
- Phase 4 : débat, vote, élimination, victoire.

## Environnement
Mac. Variables Vercel et .env.local : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (clé publique uniquement).