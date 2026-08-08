# Spec — Génération de voyage assistée par IA (NestTrip)

## 1. Contexte et objectif

Aujourd'hui, la création d'un voyage suit un parcours 100% manuel : l'utilisateur arrive sur l'écran "Nouveau voyage", saisit Destination / Nom / Dates via 3 dialogues séquentiels, puis crée le voyage et construit son itinéraire à la main (activités choisies une par une via Google Places, assignées jour par jour).

**Objectif** : ajouter une option de génération assistée par IA qui peut soit (a) proposer un pool d'activités pertinentes que l'utilisateur assigne ensuite lui-même, soit (b) construire un itinéraire complet jour par jour (activités + logements + transports), tout en restant 100% éditable après coup — sans alourdir le parcours manuel existant pour les utilisateurs qui ne veulent pas de l'IA.

**Contraintes actées :**
- NestTrip est un **planificateur**, pas un moteur de réservation : l'IA suggère, elle ne réserve rien.
- Google Places est déjà intégré côté création manuelle d'activités — pas de nouvelle source de données à brancher pour les activités.
- Pas de catalogue interne d'activités/logements/transports : tout passe par des sources externes (Places pour les activités ; à définir pour logements/transports, cf. §6).
- V1 volontairement simple : pas de régénération jour par jour, pas de moteur de réservation.

---

## 2. Parcours UX

### 2.1 Principe directeur

Le mode IA est **opt-in et tardif** dans le formulaire : il n'apparaît qu'une fois que Destination, Nom et Dates sont renseignés (les 3 dialogues actuels, inchangés). Un utilisateur qui ignore cette option ne voit aucune étape supplémentaire et le bouton "Créer le voyage" se comporte exactement comme aujourd'hui. Il faut donc désactiver le clique automatique sur création trip après que l'utilisateru ai remplit le formulair via les dialogues qui s'enchainent.

### 2.2 Écran "Nouveau voyage" — évolution

Une fois les 3 champs existants remplis, une 4ᵉ zone apparaît en bas de l'écran (au-dessus des boutons Annuler / Créer le voyage), il faut utiliser le même affichage et composant que "app-select-button--solid" mais avec 2 options :

```
Comment veux-tu organiser ce voyage ?

┌─────────────────────┐   ┌─────────────────────┐
│  ✓ Je planifie      │   │   Laisser l'IA      │
│    moi-même         │   │   m'aider ✨        │
│  (sélectionné par   │   │                     │
│   défaut)           │   │                     │
└─────────────────────┘   └─────────────────────┘
```

- Carte "Je planifie moi-même" sélectionnée par défaut → comportement actuel inchangé.
- Carte "Laisser l'IA m'aider" → Affiche le reste du formulaire, piloté par ce bouton, en dessous.

il contient : 
- un "app-select-button--solid" avec 2 options correspondant à : 
    Segmented control à 3 choix :
    - `activities_only` — "Suggerer des activités" : l'IA propose un pool d'activités à assigner soi-même, comme en mode manuel. 
    - `activities_day` — "Suggerer un parcours" : l'IA propose un pool d'activités et l'assigne selon les jours, mais ne s'occupe pas des logements et transport. -> Selectionné par défaut
    - `full_plan` — "Tout planifier" : logements, transports et activités, organisés jour par jour.
- "app-select-button--solid"  Type de voyageurs avec 4 options  : Solo / Couple / Famille / Amis (couple Amis par défaut)
- "app-select-button--solid" Rythme avec 3 options  : Détente / Équilibré / Intensif -> (équilibré sélectionné par défaut)
- Centres d'intérêt (multi) : Musées & culture, Nature & randonnée, Sport, Gastronomie, Vie nocturne, Shopping, Farniente, Insolite... : Au clique, cela ouvre une liste comme tous les autre spattern de l'application
- Toggle "Plusieurs villes ?" → si activé, champ de saisie/recherche pour lister les villes (réutilise le composant de recherche de ville déjà existant sur l'écran Destination)
- Textarea libre : "Dis-nous en plus" — placeholder du type *"Ex : je veux absolument voir le Colisée, pas de randonnée, budget serré..."*. Ce champ capture tout ce qui ne rentre pas dans les chips et sert de contexte additionnel envoyé au LLM.


### 2.4 Création du voyage

Clic sur "Créer le voyage" :

- **Mode manuel** : comportement actuel inchangé, redirection immédiate vers l'éditeur de voyage vide.
- **Mode IA** : le trip est créé en base avec un statut `generating`, et l'utilisateur est redirigé vers un **écran de génération** :

```
  ⏳ On prépare ton voyage...

  ✓ Recherche des activités
  ⏳ Sélection des logements
  ○  Organisation du planning

  (annuler)
```

Les étapes affichées dépendent du niveau choisi (`activities_only` n'affiche que "Recherche des activités"). Le statut est mis à jour via polling ou websocket (cf. §5.4). Un bouton "Annuler" permet d'abandonner la génération et de repasser en création manuelle classique du même trip.

### 2.5 Écran de prévisualisation (nouveau)

**Important : rien n'est écrit dans le voyage réel avant validation par l'utilisateur.** À la fin de la génération, on affiche un aperçu :

- Mode `activities_only` : liste des activités proposées (carte activité : photo, nom, catégorie, note Places), avec pour chacune un bouton "Remplacer" et une case pour l'exclure.
- Mode `full_plan` et `activities_day` : planning jour par jour (même composant visuel que l'éditeur de voyage final, en preview), avec logements/transports/activités groupés par jour, chaque item avec bouton "Remplacer".

Actions globales en bas d'écran :
- **"Régénérer tout"** → relance la génération avec les mêmes préférences (ou renvoie au dialogue IA pour les modifier avant de relancer).
- **"Valider"** → écrit les items en base (statut `suggested`, `ai_generated: true`) et redirige vers l'éditeur de voyage classique, où tout redevient éditable/supprimable normalement. Un badge discret "Suggéré par IA" reste visible sur chaque item généré (pour transparence), sans bloquer l'édition.

### 2.6 Remplacement individuel ("Remplacer")

Sur un item de l'aperçu, "Remplacer" pioche un autre candidat dans le pool déjà récupéré pour cette catégorie (cf. §5.2) — pas de nouvel appel Places/LLM, donc instantané. Si le pool est épuisé pour cette catégorie, le bouton se désactive avec un message ("Plus d'alternative disponible pour cette catégorie").

### 2.7 Hors scope v1 (backlog v2)

- Régénération ciblée d'un seul jour du planning.
- Prise en compte du budget chiffré comme contrainte dure (v1 : le budget n'est qu'une info libre dans le texte, pas un filtre strict).
- Réservation réelle des logements/transports proposés.

---

## 3. Modèle de préférences (contrat, pas schéma BDD)

Objet envoyé par le client à la création du trip en mode IA :

```json
{
  "assistanceLevel": "activities_only" | "full_plan",
  "travelerType": "solo" | "couple" | "family" | "friends" | null,
  "pace": "relaxed" | "balanced" | "intense" | null,
  "interests": ["museums", "nature", "sport", "food", "nightlife", "shopping", "offbeat"],
  "multiCity": true | false,
  "cities": ["Rome", "Florence"],
  "freeText": "je veux absolument voir le Colisée, pas de randonnée"
}
```

Ce même objet est réutilisé tel quel si l'utilisateur ré-ouvre le dialogue IA pour modifier ses choix, et ré-envoyé tel quel (ou modifié) lors d'un "Régénérer tout".

---

## 4. Architecture du pipeline de génération

Principe : **le LLM ne choisit jamais librement des lieux "de mémoire"**. Il sélectionne et organise à partir d'une liste de candidats réels récupérée via des sources de données externes. Ça évite les hallucinations (adresses inexistantes, lieux fermés, etc.) et garde une trace vérifiable de la provenance de chaque suggestion.

```
[Client] --préférences--> [API create trip (mode=ai)]
                                 |
                                 v
                    [Trip créé, statut=generating]
                                 |
                                 v
                    [Job asynchrone de génération] (queue)
                                 |
        ┌────────────────────────┼────────────────────────┐
        v                        v                         v
  [Recherche activités]   [Recherche logements]     [Recherche transports]
   (Google Places, déjà     (source à définir,        (source à définir,
    existant)                cf. §6)                   cf. §6)
        |                        |                         |
        └────────────────────────┼────────────────────────┘
                                 v
                    [Pool de candidats bruts]
                    (mis en cache, TTL session)
                                 v
                    [Appel LLM — sélection & organisation]
                    (tool use / function calling contraint
                     aux candidats du pool)
                                 v
                    [JSON structuré : itinéraire proposé]
                                 v
                    [Validation de schéma]
                                 v
              [Trip statut=ready_for_preview] --notif--> [Client affiche l'aperçu]
```

### 4.1 Étape 1 — Recherche de candidats

- **Activités** : réutilisation de l'intégration Google Places existante, avec des paramètres élargis (types de lieux dérivés des `interests`, rayon = zone de la destination, note minimale). On récupère un pool large (~20-30 candidats par centre d'intérêt) plutôt que le strict nécessaire, pour permettre le "Remplacer" sans nouvel appel.
- **Logements** et **Transports** : uniquement en mode `full_plan`. Pas de source déjà branchée — à cadrer (§6) avant l'implémentation de ce sous-flux. Le mode `activities_only` ne dépend pas de cette brique et peut être livré indépendamment.

### 4.2 Étape 2 — Sélection par le LLM

Le LLM reçoit :
- Le pool de candidats (id, nom, catégorie, coordonnées, note, description courte).
- Les préférences utilisateur (§3).
- Les dates du voyage (nombre de jours, éventuellement horaires d'ouverture des lieux si disponibles).
- En mode `full_plan` uniquement : les contraintes de logique de planning (pas deux activités trop éloignées le même jour, cohérence géographique jour par jour si multi-villes).

Il doit retourner un JSON structuré respectant un schéma fixe (liste d'items avec `candidateId`, `day` (null en mode `activities_only`), `startTime`/`endTime` optionnels, `reason` — courte justification affichable à l'utilisateur, ex. "Choisi pour ton intérêt musées").

On utilise le tool use / function calling pour forcer le LLM à ne renvoyer que des `candidateId` existants dans le pool fourni (pas de champ libre pour le nom/l'adresse) — c'est la garde-fou anti-hallucination.

### 4.3 Étape 3 — Validation et persistance

- Validation du JSON contre le schéma attendu (candidateId existants, dates dans la plage du trip, etc.). En cas d'item invalide, on le retire silencieusement plutôt que d'échouer toute la génération.
- **Rien n'est encore écrit dans les tables définitives du trip à ce stade** : le résultat est stocké dans une structure de préview (liée au trip, statut `ready_for_preview`) pour que "Régénérer tout" et "Remplacer" restent sans effet de bord.
- À la validation utilisateur (§2.5), seulement là, création des vrais enregistrements d'activité/logement/transport, avec `source: ai_generated`, `status: suggested`.

### 4.4 Suivi de progression côté client

- Court-polling (ex. toutes les 2s) sur un endpoint `GET /trips/:id/generation-status` renvoyant l'étape en cours + statut global (`generating` / `ready_for_preview` / `failed`). Suffisant pour une v1 (pas besoin de websocket tout de suite).
- Timeout raisonnable (ex. 90s) : au-delà, statut `failed` avec message et proposition de repasser en création manuelle.

### 4.5 Gestion des échecs partiels

Si une des sources (ex. logements) échoue mais pas les autres : on livre quand même l'aperçu avec les catégories disponibles, et un message clair sur la catégorie manquante ("On n'a pas pu proposer d'hébergement, tu peux l'ajouter toi-même"). On ne bloque jamais toute la génération pour l'échec d'une seule source.

---

## 5. Régénération et remplacement (rappel des mécanismes)

| Action | Portée | Coût | Nouvel appel LLM ? | Nouvel appel source externe ? |
|---|---|---|---|---|
| "Remplacer" un item | 1 item | instantané | Non | Non (pioche dans le pool en cache) |
| "Régénérer tout" | Tout l'aperçu | quelques secondes | Oui | Seulement si les préférences ont changé de façon significative (ex. nouvelles villes) |

Le pool de candidats est mis en cache côté serveur (clé = trip + préférences), avec une TTL courte (ex. durée de la session de génération/preview, quelques heures max) pour ne pas re-solliciter Google Places à chaque "Remplacer".

---

## 6. Points à cadrer avant implémentation du mode `full_plan`

Ces points ne bloquent pas le développement du mode `activities_only`, qui peut être livré en premier :

1. **Source de données logements** : API à intégrer (ex. Google Places propose aussi des hôtels, à évaluer si suffisant pour une v1, sinon Booking/autre) — sans réservation, juste de la donnée descriptive (nom, adresse, note, fourchette de prix si dispo).
2. **Source de données transports** : trajets inter-villes (train/bus/vol) — a minima donner une estimation générique ("prévoir ~2h de train Rome → Florence") si aucune API de trajet n'est branchée en v1, plutôt que de bloquer sur cette brique.
3. **Granularité horaire du planning** : le LLM doit-il proposer des horaires précis (9h-11h musée) ou juste un ordre dans la journée (matin/après-midi/soir) ? Recommandation v1 : ordre dans la journée uniquement, plus simple et moins fragile (évite les conflits d'horaires d'ouverture mal connus).

---

## 7. Découpage suggéré du développement

1. **Lot 1 — UX manuel inchangé + dialogue IA (front only)** : ajout de la 4ᵉ carte et du dialogue 3 étapes sur l'écran de création, sans branchement backend (préférences stockées mais pas encore envoyées).
2. **Lot 2 — Mode `activities_only` end-to-end** : pipeline recherche Places → sélection LLM → écran de génération → aperçu → validation → création des activités suggérées. C'est le lot qui valide toute la mécanique (cache pool, remplacement, statuts).
3. **Lot 3 — Mode `full_plan`** : ajout logements/transports + planning jour par jour, une fois les sources de données cadrées (§6).
4. **Lot 4 (optionnel)** : régénération ciblée par jour, si les retours utilisateurs du lot 2/3 le justifient.

---

## 8. Résumé des invariants à respecter

- Aucune étape supplémentaire imposée au parcours manuel existant.
- Le LLM ne sélectionne que parmi des candidats réels préalablement recherchés — jamais de génération libre de lieux.
- Rien n'est écrit dans les tables définitives du trip avant validation explicite de l'aperçu par l'utilisateur.
- Tout élément généré par l'IA reste, après validation, un élément parfaitement normal et éditable du trip (même modèle de données que le manuel, juste un flag de provenance).