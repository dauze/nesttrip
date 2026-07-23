export function getInitials(displayName: string | undefined, email: string): string {
  if (displayName) {
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}
