/** Longueur max des champs "titre" (activité/logement/transport, adresse saisie librement) — ROADMAP.md "Qualité / process". */
export const MAX_TITLE_LENGTH = 100;

/** Longueur max des champs "notes" (activité/réservation) — ROADMAP.md "Bugs / fixes", compteur X/5000 affiché dans NotesEditDialogComponent. */
export const MAX_NOTES_LENGTH = 5000;

/** Taille max d'un fichier uploadé (photos, PDF...) — ROADMAP.md "Qualité / process". */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Extensions autorisées à l'upload (voir `FilesFieldComponent`) — ROADMAP.md "Qualité / process", audit de sécurité :
 * empêche l'hébergement de contenu arbitraire (HTML/SVG...) sous une URL Storage liée à un trip. */
export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];
