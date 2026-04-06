/**
 * CancelReservationCommand — AC-013 (member self-cancellation).
 */
export class CancelReservationCommand {
  constructor(
    /** Resolved internal memberId from JWT sub. */
    public readonly memberId: string,

    /** reservationId from the URL path parameter (ULID). */
    public readonly reservationId: string,
  ) {}
}
