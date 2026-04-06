/**
 * Reservation status value object.
 *
 * Lifecycle:
 *   CONFIRMED → CANCELLED  (member AC-013, or manager AC-015)
 *   CONFIRMED → EXPIRED    (expirer AC-016)
 */
export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export function isReservationStatus(value: string): value is ReservationStatus {
  return Object.values(ReservationStatus).includes(value as ReservationStatus);
}
