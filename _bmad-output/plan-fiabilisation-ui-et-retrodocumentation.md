---
title: 'Fiabilisation UI, carte General et retrodocumentation responsive'
type: 'bugfix'
ticket: ''
created: '2026-11-03'
status: 'built'
baseline_revision: '861fa35ed26939bd4eb1ab4911a7494c047bf557'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
	- '{project-root}/CLAUDE.md'
	- '{project-root}/DESIGN.md'
	- '{project-root}/.claude/skills/nesttrip-verify/SKILL.md'
	- '{project-root}/.claude/skills/nesttrip-e2e/SKILL.md'
	- '{project-root}/.claude/skills/nesttrip-testing/SKILL.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Scroll intermittent, carte General incoherente, clics et focus defaillants, arrondis variables ; voyage et reglages peu visibles ; absence d'inventaire responsive pour audit UX.

**Approach:** Trois lots conserves avec accord utilisateur : correctifs, evolutions UX validees, retrodocumentation desktop/mobile. Reproduire avant de corriger ; distinguer observation, code et proposition.

## Boundaries & Constraints

**Always:** Tokens --nt-*, PrimeIcons, composants et breakpoints existants, store immutable et placements multiples. Compte e2e dedie, secrets locaux ignores, modele vide. Preserver les edits utilisateur. Conserver la disposition de l'en-tete ; pas de refonte structurelle sans maquette validee.

**Never:** Commit, secrets affiches/suivis, modification des environnements, suppression d'attribution Google, refonte hors perimetre ou modification des permissions voyageurs. Emulation mobile ne prouve pas le clavier iOS/Android.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Carte | Plusieurs types/jours, titre long, photo absente | Couleurs type, jours chronologiques, clic placement, bandeau stable sans chevauchement | Aucune coordonnee inventee |
| Scroll | Navigation, clic carte, fermeture overlay imbrique | Scroll utilisable, automatisme interruptible | Nettoyage listeners/verrous |
| Saisie | Depense, vol, train | Champ actif puis restauration correcte du focus | Aucun overlay Google parasite |
| Geolocalisation | Reglage global desactive/active, permission refusee | Aucun appel quand desactive ; position partagee et recentrage coherent quand active | Message explicite, pas de demande automatique repetee |

## Decisions Validees

- 2026-11-03 : "reessaye et fais tout" approuve le plan multi-lots et la recommandation d'en-tete local : vrai nom du voyage en titre, dates dessous, commande explicite "Parametres du voyage" (crayon). Pas de deplacement des colonnes ni refonte structurelle.
- Precision utilisateur via question : "Geolocalisation : autoriser l'affichage de ma position sur les cartes". Centraliser cette preference dans la roue crantee globale (comme theme/devise), locale au navigateur, sans changer les permissions systeme. Une activation explicite demande la position ; les cartes partagent le resultat et n'interrogent pas chacune le navigateur. Refus/indisponibilite geres ; desactivation retire position/erreur. Reutiliser les toggles et services existants. Un controle de recentrage peut rester sur la carte uniquement lorsque la preference est active.

</frozen-after-approval>

## Code Map

Sous `src/app/features/trips/trip-detail/` :
- `trip-day-swiper/general-panel/trip-summary/trip-summary.component.{ts,html,scss}` : couleurs par jour ; titre span, pointer-events:none, largeur variable.
- `trip-day-swiper/day-panel/trip-day-map/trip-day-map.component.*` : marqueurs/controles partages ; conserver les rangs Jour. Modele : `src/app/core/models/day-map-point.ts`.
- `trip-day-swiper/day-panel/day-scroll-sync.service.ts` : scroll remesure et budget rAF ; cause du blocage non prouvee.
- `trip-header/` : reglages voyage locaux. Roue globale : `src/app/features/trips/trips.component.html`.

Commun :
- `src/app/shared/services/dialog.service.ts`, `src/app/shared/components/overlays/simple-text-entry-dialog/` : autofocus deja configure ; verifier concurrence parent/enfant.
- `src/styles/dialog.scss` : Voyageurs a un rayon mobile 2xl specifique ; token modal commun disponible.
- `src/app/app.routes.ts`, `src/app/shared/components/overlays/`, `src/styles/field-edit-dialogs.scss` : inventaire, a recouper avec les appels.
- `e2e/fixtures/auth.ts`, `playwright.config.ts` : connexion/dotenv existants ; artefacts ignores.

## Tasks & Acceptance

**Execution:**
- [x] `.env.e2e.example` / `.env.e2e` : secrets deplaces, modele vide, ignore/non-suivi verifies.
- [x] `e2e/login.spec.ts` : connexion authentifiee reussie le 2026-11-03.
- [x] `day-scroll-sync.service.ts` et overlay responsable : interruption synchrone, touchcancel et nettoyage ; garde-fou conserve, scroll jusqu'au bas teste.
- [x] `trip-summary.component.*`, `trip-day-map.component.*`, `day-map-point.ts` : couleurs type, badges jours, bandeau cliquable stable, controles libres, raccourcis masques.
- [x] Editeurs concernes et `src/styles/dialog.scss` : focus explicite, fermeture prix avant callback et rayon modal commun ; imbrication testee.
- [x] `trip-header/`, `trips.component.*` et service partage : titre reel/dates/commande explicite ; geolocalisation globale.
- [x] `src/specs/inventaire-ux-responsive.md` : 21 familles de vues, 30 surfaces temporaires, liens sources et couverture visuelle explicite.
- [x] `e2e/` et specs pures existantes : regressions ciblees, fixtures reutilisees.

**Acceptance Criteria:**
- Given General/Jour, when navigation et fermeture d'overlays sont repetees, then scroll possible jusqu'en bas.
- Given le tour General, when le bandeau change, then jour/type/clic correspondent au placement sans masquer Street View.
- Given un editeur depense/vol/train, when ouvert depuis son parent, then saisie directement possible.
- Given Voyageurs/autres dialogues, when ouverts sur mobile/desktop, then rayon commun valide.
- Given l'inventaire, when recoupe avec routes/appels, then toutes surfaces couvertes et preuves distinguees des propositions.

## Implementation Notes

- 2026-11-03 : protection des identifiants effectuee et validee. Aucun commit.
- Chromium installe ; login reste sur /login, page "Verifiez votre email". Aucun visuel authentifie verifie.
- Reprise : login e2e passe (1/1). Dernier "fais tout" vaut approbation ; choix geolocalisation confirme via question. Aucun commit ni push autorise. Le message precedent de verification email est historique, plus un blocage actuel.
- Le correctif scroll doit reposer sur une reproduction ou un mecanisme demontre (notamment roue/tactile carte, lock drag et fermeture overlay), pas une suppression speculative de securites. Documenter les limites si aucun blocage reproduit.
- Les verifications visuelles utilisent uniquement les identifiants locaux par la fixture ; ne jamais afficher leurs valeurs ni creer de script suivi avec secrets. Creer si necessaire un voyage dedie aux checks et supprimer uniquement ces donnees de test creees durant la verification.
- Verification finale applicative : lint, typecheck et 256 tests unitaires passent. Les 4 tests UI desktop/mobile passent ensemble ; connexion/creation/dates passent aussi lors du run complet precedent. Les nouveaux tests suppriment uniquement leur propre voyage.
- Carte : couleurs/badges verifies pendant le focus de chaque placement (Google retire certains points trop proches du DOM au zoom global). La cle de tracking inclut le proprietaire Jour/General pour renouveler les callbacks de contexte. Le test attend une sauvegarde reelle et recalcule la zone visible avant les gestes de molette.
- Visuel : captures desktop/mobile effectivement lues (carte J3, bandeau sans chevauchement, Voyageurs, gare, reglages globaux). Raster Maps reel, Places et position simules dans les tests. Clavier natif et autres familles non visitees restent explicitement non verifies dans l'inventaire.
- Matrice : Carte couverte par computeGeneralMapPoints + 2 e2e carte ; Scroll par 8 specs scroll + 2 e2e carte et retour de dialogues ; Saisie par 2 e2e (gare mobile, depense et vol) ; Geolocalisation par 8 specs service et 2 e2e de preference. Aucun test saute.
- Apres correctifs de revue : lint, typecheck, 256 tests unitaires et les 7 e2e complets passent. `git diff --check` passe ; modele sans valeurs et fichier local ignore/non suivi reconfirmes. Aucun commit : instruction explicite utilisateur prioritaire sur l'etape de commit du workflow.

## Plan Change Log

## Review Triage Log

Revue quick : 4 constats confirmes, 4 correctifs locaux ; aucun report.

| Constat | Verdict | Route | Preuve et correction |
| --- | --- | --- | --- |
| Hauteur du bandeau non reservee | medium | patch | `@if` supprime le bouton lors des pauses ; slot permanent reserve 4.25rem et marge. Hauteur affichee/masquee comparee par les 2 e2e carte. |
| Recentrage repris par le tour | medium | patch | Les controles desktop ne declenchaient ni wheel ni touch ; les clics dans le conteneur interrompent maintenant le tour, avec cleanup du listener. Les 2 e2e carte verifient interruption/reprise. |
| Ancien jour capture par le listener marqueur | medium | patch | Le callback conservait `point` a l'initialisation ; il relit maintenant le point courant par id au clic. |
| Reglages globaux sans nom du bouton natif | medium | patch | Attribut sur host non transmis ; texte projete visuellement masque dans le bouton et icones decoratives aria-hidden. Les 2 e2e dialogues trouvent le bouton par son nom exact. |

## Verification

**Commands:**
- Ignore/non-suivi et deux variables vides : valide.
- Check cible apres chaque edit ; puis `npx ng lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false`, dans cet ordre.
- `npx playwright test e2e/login.spec.ts`, specs corrigees et dates si reglages touches.

**Visual checks:** Captures Playwright desktop/mobile effectivement lues : Maps/Fonts/reseau, bandeau/Street View, scroll, focus, rayon, en-tete. Inventaire exhaustif du code et couverture visuelle explicite, sans succes suppose.