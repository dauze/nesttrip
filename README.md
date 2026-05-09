/**
 * ============================================================
 * TYPE OBJECT – Structure complète d'un jour de voyage à donner à Claude pour la génération d'un future voyage
 * ============================================================
 */

const JourType = {

  // Identifiant unique du jour (ex: "j1", "j2", ...)
  id: "string",

  // Libellé affiché dans la navigation (ex: "Ven. 15 mai")
  navLabel: "string",

  content: {

    // Titre principal affiché en haut de la fiche
    title: "string",

    // Sous-titre descriptif (résumé du programme)
    subtitle: "string",

    // Badges résumant la zone géographique ou les événements spéciaux
    badges: [
      {
        text: "string",
        class:
          // Zone géographique (couleur neutre/bleue)
          | "badge-zone"
          // Événement spécial ou nouveau (couleur accent/colorée)
          | "badge-new"
      }
    ],

    // Frise chronologique de la journée (ordre chronologique)
    timeline: [
      {
        time: "string",    // Heure affichée (ex: "7h00", "~12h30")
        color:
          | "orange"       // Arrivée / transit aérien / transport entrant
          | "gray"         // Pause / repas / temps libre
          | "blue"         // Activité / visite / exploration
          | "green"        // Arrivée à destination finale / fin de journée
          | "yellow"       // Repas / déjeuner
          | "red"          // Urgence / embarquement critique / deadline
          | "purple",      // Soirée culturelle / événement de nuit
        content: "string"  // Description de l'étape (peut contenir des <em>)
      }
    ],

    // Blocs de contenu structurés par moment de la journée
    slots: [
      {
        type:
          | "morning"      // Bloc matin
          | "meal"         // Repas (déjeuner ou dîner)
          | "transit"      // Trajet / transport (train, avion)
          | "afternoon"    // Bloc après-midi
          | "evening"      // Soirée

        icon: "string",    // Emoji représentatif du bloc
        time: "string",    // Plage horaire (ex: "9h00 – 12h00")
        name: "string",    // Titre du bloc

        // === UNIQUEMENT pour type "meal" ===
        // Texte HTML libre décrivant le repas (peut contenir <strong>, <em>)
        meal: "string | undefined",

        // === POUR tous les types SAUF "meal" ===
        activities: [
          {
            name: "string",  // Nom de l'activité

            badges: [
              {
                text: "string",
                class:
                  | "pill-duration"  // Durée estimée (ex: "2h", "45 min")
                  | "pill-res"       // Réservation recommandée ou obligatoire
                  | "pill-free"      // Gratuit ou sans réservation
                  | "pill-best"      // Option recommandée / coup de cœur
                  | "pill-alt"       // Option alternative (2e ou 3e choix)
                  | "pill-urgent"    // Action urgente à faire immédiatement
              }
            ],

            // Grille de données clé/valeur (infos pratiques)
            // Peut contenir du HTML dans value (<a>, <strong>)
            grid: [
              {
                label: "string",
                value: "string"
              }
            ],

            // Bloc transport optionnel associé à l'activité
            transport: {
              icon: "string",  // Emoji du mode de transport
              text: "string"   // Description du trajet
            } | undefined,

            // Conseil ou astuce affiché en bas de l'activité
            tip: "string | undefined"
          }
        ] | undefined
      }
    ],

    // Encart d'alertes / checklist affiché en bas de la fiche
    alerts: {
      title: "string",   // Titre de l'encart (avec emoji)
      points: [
        // Tableau de strings HTML (peut contenir <strong>)
        "string"
      ]
    } | undefined
  }
};