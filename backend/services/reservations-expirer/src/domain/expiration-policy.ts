/**
 * Pure domain function — zero external dependencies.
 *
 * Determines whether a reservation slot has already ended.
 *
 * @param date     - Reservation date in YYYY-MM-DD format (e.g. "2026-04-20")
 * @param endTime  - Slot end time in HH:MM format (e.g. "18:00")
 * @param now      - Current moment (defaults to new Date(), injectable for testing)
 * @returns true when the slot end time is strictly in the past
 */
export function isExpired(date: string, endTime: string, now: Date = new Date()): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = endTime.split(':').map(Number);
  const endDate = new Date(year, month - 1, day, hour, minute, 0);
  return endDate < now;
}
