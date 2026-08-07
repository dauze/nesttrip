# NestTrip — Évolution de la budgétisation

Spec fonctionnelle/technique pour Claude Code. Décrit l'écart entre l'existant et la cible, à lire avant toute implémentation (revue de code existant + plan phasé attendu, comme pour les autres features).

## 1. Contexte — état actuel

- Chaque logement/transport/activité expose un prix saisi via une pop-up (montant + devise) au clic sur le prix.
- L'onglet résumé du voyage affiche : le total (somme brute des sous-montants, sans conversion), un donut des 4 plus grosses dépenses + une catégorie "autre", et un sélecteur de devise qui ne fait qu'initialiser la devise par défaut des nouvelles cartes.

## 2. Limites actuelles à résoudre

1. Une carte ne peut pas afficher un montant dans une devise différente de celle du voyage.
2. Le total est faux dès qu'il y a plusieurs devises (somme brute, pas de conversion).
3. Impossible d'ajouter une dépense libre non rattachée à une activité (ex. un smoothie).
4. La légende du donut prend trop de place.
5. La devise par défaut de l'onglet résumé n'est jamais déduite du lieu du voyage (placeId disponible).

## 3. Décisions de design retenues

### 3.1 Pas de devise de référence stockée au niveau du voyage

Revu après discussion : la devise de référence du voyage (`trip.referenceCurrency`) est **supprimée du modèle** et de l'écran de résumé.

Le pivot nécessaire pour sommer des dépenses saisies dans des devises différentes (hôtel en THB, vol en EUR, activité en JPY) n'a pas besoin d'être une valeur stockée et partagée au niveau du voyage — c'est **la devise de l'utilisateur qui consulte** l'écran, appliquée à la volée au moment de l'affichage. Deux raisons à ça :

- NestTrip supporte des voyages partagés entre plusieurs membres. Si la devise pivot était fixée au niveau du trip, deux membres avec des devises personnelles différentes verraient un total qui n'a de sens que pour l'un des deux. En calculant côté viewer, chacun voit son propre total dans sa propre devise, sans état à synchroniser ni paramétrage à faire à la création du voyage.
- Ça supprime un champ, un écran de configuration, et une source de désynchronisation possible entre membres.

Deux notions à distinguer dans le modèle (aucune des deux n'est stockée au niveau du voyage) :
- **Devise d'agrégation (calcul, non stockée)** : devise de l'utilisateur courant, lue depuis son profil, appliquée en mémoire au moment du calcul du total. Jamais persistée sur le voyage.
- **Devise suggérée à la saisie** (par carte) : devise locale du pays où se déroule l'activité/logement/transport, déduite du `placeId` propre à cette carte. Sert uniquement à pré-remplir la pop-up de saisie pour limiter la friction (on saisit plus vite en devise locale au quotidien). Aucun lien avec la devise d'agrégation.

### 3.2 Devise par défaut du profil utilisateur

Détection automatique via la locale du navigateur (`Intl.NumberFormat().resolvedOptions().locale` ou `navigator.language`) mappée à une devise via une table de correspondance locale → devise. Fiable à ~90 %, pas de champ "pays" à l'inscription.

Point important : cette locale reflète la langue/région configurée au niveau OS/navigateur de l'utilisateur (ex. `fr-FR`, `fr-CA`, `fr-BE`), pas la langue affichée par l'app. Elle est donc disponible et fiable dès aujourd'hui, même si NestTrip n'a qu'une UI en français — un utilisateur avec `fr-CA` remontera CAD, pas EUR. La table de correspondance doit mapper sur la locale complète (code région inclus), pas seulement sur le préfixe de langue, sinon `fr-FR` et `fr-CA` sont confondus à tort.

Stockée comme préférence utilisateur, éditable librement dans les paramètres du profil via la roue cranté (simple picker, pas de formulaire).

Point d'évolution futur (hors scope immédiat) : au packaging Capacitor, remplacer/compléter la détection par le plugin `Device` pour une localisation plus fiable que la seule locale navigateur — sans changement de modèle de données, seule la source de détection change.

### 3.3 Taux de change — figé selon le statut de la réservation

Les activités/réservations portent déjà un flag `statut` (`à réserver` / `réservé`). On s'appuie dessus pour la conversion :

- **Statut `à réserver`** : montant affiché recalculé dynamiquement avec le taux de change courant à chaque affichage (budget prévisionnel, indicatif).
- **Statut `réservé`** : au moment du passage à ce statut, le taux courant est figé et stocké avec la dépense (`montantOriginal`, `deviseOriginale`, `tauxFige`, `montantConverti`). Le montant affiché ne bouge plus ensuite, même si le taux de marché évolue — comme un reçu réel.

Pour les dépenses libres (non rattachées à une activité, cf. 3.4), pas de notion de statut réservé/à réserver : le taux est figé dès la saisie (ce sont des dépenses déjà engagées par nature).

Gestion offline : si aucun taux n'est disponible au moment requis, utiliser le dernier taux mis en cache avec un indicateur visuel discret ("taux approximatif").

### 3.4 Dépenses libres

Nouvelle entité "dépense libre" (ex. un smoothie, un pourboire, tout ce qui n'est pas rattaché à une activité/logement/transport). Accessible et gérée depuis le même tableau que les dépenses issues des activités (cf. 3.5), avec un statut "figé dès saisie" implicite (pas de flag `à réserver`/`réservé` pour ce type).

### 3.5 Refonte de l'onglet résumé

**Schéma** : remplacement du donut + légende externe par le pattern "anneau avec montant au centre" (type Apple Health / YNAB). Le total (dans la devise de l'utilisateur courant) s'affiche à l'intérieur du cercle, plus de ligne de montant séparée au-dessus. Plus de légende texte en dessous : chaque part est identifiable par couleur + une icône de catégorie positionnée sur/à côté de la part. Le détail (libellé + montant) s'affiche dans une bulle au tap sur une part, qui se ferme au tap ailleurs. Un lien discret sous l'anneau ("voir toutes les dépenses") ouvre le tableau détaillé ci-dessous — c'est le seul point d'entrée texte restant, pas de légende permanente.

En plus de la devise utilisateur au centre, afficher en plus petit l'équivalent en devise locale de la destination (utile sur place pour se repérer dans les prix du quotidien), ex. `1 278 € (~46 200 ฿)` — cette devise locale est déduite du `placeId` du voyage, purement informative, jamais stockée comme pivot de calcul (cf. 3.1).

**Tableau détaillé** : accessible depuis le lien sous l'anneau, pop-up avec un tableau de toutes les dépenses du voyage, 3 colonnes : montant (converti dans la devise utilisateur), libellé, date.
  - Les lignes issues d'une activité/logement/transport sont grisées (lecture seule dans ce tableau) — modification uniquement depuis la carte source, pour garder une seule source de vérité par dépense.
  - Les lignes de dépenses libres sont éditables directement depuis ce tableau.
  - Ajout d'une dépense libre : bouton `+` en dernière ligne, ouverture d'une pop-up en chaînage (montant + devise → libellé → date, initialisée à la date du jour).
  - Suppression : appui long pour entrer en mode sélection multiple, cohérent avec le pattern déjà utilisé ailleurs dans l'app. Les lignes grisées (issues d'activités) sont sélectionnables mais non supprimables depuis ce tableau ; un message informe qu'elles se modifient depuis leur carte source.

## 4. Modèle de données — impacts pressentis

À valider/affiner lors de la lecture du code existant (`TripFirebase`, `TripStore`, `TripFacade`, `TripRepository`) :

- Aucun champ `referenceCurrency` sur `TripFirebase` — pas de devise pivot stockée au niveau du voyage (cf. 3.1).
- Nouveau top-level `expenses` (ou équivalent) sur `TripFirebase`, suivant le même pattern dot-notation que les autres collections du document — pour les dépenses libres, indépendant du `days`/`reservations` map existant.
- Sur chaque entité porteuse d'un prix (activité/logement/transport/réservation) : `montantOriginal`, `deviseOriginale`, et, une fois `statut = réservé`, `tauxFige` + `montantConverti` figés à cet instant.
- Préférence utilisateur : devise par défaut détectée/choisie, stockée au niveau du profil utilisateur (pas du voyage).
- Service de conversion de devises : à définir (API + fréquence de rafraîchissement + cache Firestore partagé, sur le modèle de ce qui a été fait pour AeroDataBox/flight status — mutualiser la logique de cache si pertinent).

## 5. Hors scope / à trancher plus tard

- Choix du fournisseur d'API de taux de change (à comparer : exchangerate.host, Fixer, autre — critères : gratuité/quota, fiabilité, devises exotiques type THB/JPY).
- Détection de devise via Capacitor `Device` plugin (améliorera 3.2 sans changer le modèle).
- Revue UX du sélecteur de devise (`p-select` / bottom sheet `p-drawer` + `p-listbox`) — sujet déjà identifié séparément, à mutualiser si le picker de devise est concerné.

## 6. Attendu de Claude Code

Comme pour les features précédentes : lire le code existant (`TripFirebase`, `TripStore`, `TripFacade`, `FirebaseTripRepository`, composants de l'onglet résumé et des pop-up de prix) avant de proposer un plan. Découper en phases indépendamment testables, par exemple :

1. Modèle de données + service de conversion de devises (avec cache Firestore), sans champ de devise pivot stocké sur le voyage.
2. Détection devise profil utilisateur (locale navigateur, région incluse) + devise suggérée à la saisie par carte (placeId propre à chaque activité/logement/transport).
3. Dépenses libres (CRUD) + tableau détaillé en pop-up avec lignes grisées/éditables.
4. Refonte visuelle : anneau avec montant total centré (devise utilisateur) + équivalent devise locale destination en sous-texte, suppression de la légende externe, tap-to-detail par part.
5. Logique de figeage du taux selon le statut `à réserver`/`réservé`.

Livrer des fichiers complets prêts à copier, PrimeNG/PrimeFlex en priorité, pas de couleurs/padding custom en SCSS sauf dernier recours.