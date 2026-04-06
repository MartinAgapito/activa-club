/**
 * ManagerCancelReservationCommand — AC-015 manager cancellation.
 *
 * Managers may cancel any CONFIRMED reservation regardless of the 2-hour window.
 * A reason is required (10–500 characters).
 */
export class ManagerCancelReservationCommand {
  constructor(
    public readonly reservationId: string,
    public readonly reason: string,
  ) {}
}
