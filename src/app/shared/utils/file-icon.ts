/** Icône PrimeIcons selon l'extension du fichier — même mapping que `FilesFieldComponent`, extrait ici pour être réutilisé en lecture seule (ex. `TripFilesTileComponent`). */
export function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'pi-file-pdf',
    jpg: 'pi-image', jpeg: 'pi-image', png: 'pi-image', webp: 'pi-image',
    doc: 'pi-file-word', docx: 'pi-file-word',
  };
  return `pi ${map[ext] ?? 'pi-file'}`;
}

/** Ouvre un fichier Storage dans un nouvel onglet — même appel que `FilesFieldComponent.openFile`. */
export function openFile(file: { url: string }): void {
  window.open(file.url, '_blank', 'noopener');
}
