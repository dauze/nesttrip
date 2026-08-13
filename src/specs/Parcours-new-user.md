# Parcours nouvel utilisateur — NestTrip

## Déclencheur

Flag dédié `has_seen_onboarding` (booléen sur le compte utilisateur), mis à `true` à la fin du parcours (tour de navigation, étape 3).

Ne pas se baser sur "nombre de voyages = 0" : un utilisateur qui supprime son seul voyage plus tard ne doit pas revoir le tuto.

## Étape 1 — Écran d'accueil

"Bonjour {Prénom}, prêt à rejoindre l'aventure et créer ton premier voyage ?" → à la place de la liste vide et du libellé "Mes Voyages", UI professionnelle, chaleureuse et accueillante. Ne s'affiche que quand `has_seen_onboarding` est faux.

Bouton : **Créer nouvelle aventure** → bascule sur l'écran de création de trip.

## Étape 2 — Création du trip

**Changement de copy permanent**, indépendant du flag `has_seen_onboarding` : ces nouveaux titres remplacent définitivement les titres actuels des popups de création de voyage, pour tous les utilisateurs (nouveaux et existants), pas seulement lors du premier passage.

1. Saisie destination — nouveau titre de la popup : *"Où souhaites-tu aller ?"*
2. Une fois la destination saisie (ou après fermeture), l'utilisateur clique sur la zone "Nom du voyage" — nouveau titre de la popup : *"Donne un nom à ton voyage, tu pourras le changer plus tard"*
3. Dates — nouveau titre de la popup de saisie des dates : *"Tu pars de quand à quand ?"*

## Étape 3 — Coach marks sur l'écran du trip

À la validation, l'utilisateur atterrit sur l'écran d'accueil du trip, état par défaut = onglet **Général** actif, sous-onglet **Résumé** actif (comme l'existant).

Structure réelle de la navigation, en bas d'écran :

```
[Résumé] [Activités] [Logements & Transports] [Listes]   <- sous-onglets (visibles quand Général est actif)
[Général]                              [Jour N]         <- onglets principaux, tout en bas
```

Quand on passe sur l'onglet Jour N, la ligne de sous-onglets au-dessus devient la liste des dates du voyage (jour courant sélectionné automatiquement, ex. Jour 1 au premier clic), avec le même switch [Général] / [Jour N] toujours tout en bas.

**Principe général du tuto** : reste greyé sauf zone pointée, drawer bas d'écran (même style que la barre de suppression), navigation Suivant/Précédent, lien discret **"Passer"** visible à tout moment, indicateur de progression (ex. "1/2") sur chaque séquence.

### Vague immédiate (2 bulles, à l'arrivée sur l'écran)

Rien à révéler par clic : Résumé est déjà affiché, donc les bulles pointent directement sur ce qui est visible à l'écran.

1. **Pointée sur la barre du bas [Général] / [Jour N]**
   *"Ton voyage se pilote de 2 façons : Général pour le voir par thème, Jour N pour le voir jour par jour."*

2. **Pointée sur la ligne de sous-onglets [Résumé] [Activités] [Logements & Transports] [Listes] + le contenu Résumé déjà affiché**
   *"Tu es sur Résumé : dates, budget, pense-bête de réservations. À côté, 3 autres thèmes : Activités, Logements & Transports, Listes."*

Fin de la vague immédiate ici → petit message de clôture (ex. *"À toi de jouer !"*), puis retour à l'état normal de l'écran.

### Vague différée (just-in-time, une seule fois par élément, au premier clic sur chaque onglet)

- **1er clic sur Activités** :
  *"Crée une activité sans date et place-la sur un jour plus tard depuis cet écran, ou crée-la directement sur le jour choisi dans le menu Jour. Astuce : reste appuyé sur une carte pour la supprimer."*

- **1er clic sur Logements & Transports** :
  *"Même fonctionnement que les activités : crée-le ici ou sur un jour, tu le retrouves aux deux endroits."*

- **1er clic sur Listes** :
  *"Crée des listes : ce qu'il faut emporter, ou des tips liés à une activité précise (tu peux les relier)."*

- **Sous-séquence différée — 1er clic sur Jour N (3 bulles, même mécanisme que la vague immédiate : greyé, drawer, Suivant/Précédent, Passer)**

  Le Jour 1 s'affiche directement.

  1. Pointée sur la ligne de sous-onglets [ven. 31 juil.] [sam. 1 août] [dim. 2 août] ... :
     *"Navigue entre les jours par ici, en swipant ou en tapant directement sur une date."*

  2. Pointée sur le bouton Jour 1 :
     *"Navigue entre les jours plus rapidement par ici, en double tappant sur le bouton Jour 1."*

  3. Pointée sur le contenu déjà affiché :
     *"Voilà le déroulé de ta journée, heure par heure, avec tes activités, logements et transports."*

## Étape 4 — Astuces de gestes (hors tour de navigation)

Ces éléments ne concernent pas la structure de l'app mais des gestes isolés. Ils utilisent un format **léger**, différent du tour de navigation : tooltip ponctuel collé à l'élément concerné, pas de grisé plein écran, pas de Suivant/Précédent, dismiss automatique après quelques secondes ou au premier geste réussi.

- **Drag & drop d'une activité non planifiée** : déclenché sur la carte de l'activité qui vient d'être créée depuis le pool d'activité, au moment où cette carte apparaît dans la liste. Tooltip flottant collé à la carte : *"Tu peux la Glisser vers un jour pour la planifier."*


## Points particulier

- Reprise du tour de navigation si l'app est fermée en cours de route : reprendre où l'utilisateur s'est arrêté donc rajouter au niveau du uuser les bulles passées, au même niveau que `has_seen_onboarding`.