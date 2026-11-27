/** "45 seconds", "12 minutes", "3 hours": how long until a limit lifts, rounded up. */
export function formatWait(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `${s} ${s === 1 ? "second" : "seconds"}`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} ${m === 1 ? "minute" : "minutes"}`;
  const h = Math.ceil(m / 60);
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

/** "0:42" for a countdown. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
