/** Minutes depuis minuit pour une heure au format "HH:mm" (stockage `DayActivityInstance.startTime`/`endTime`). */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
