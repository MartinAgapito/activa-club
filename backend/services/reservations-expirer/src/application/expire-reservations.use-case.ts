/**
 * AC-016 — Expire Reservations Use Case
 *
 * Scans for CONFIRMED reservations whose slot end time has already passed
 * and transitions them to EXPIRED, releasing their slot occupancy.
 */

export interface ExpiredReservation {
  reservationId: string;
  memberId: string;
  areaId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface ExpirationRepository {
  /**
   * Returns all CONFIRMED reservations whose slot end time is in the past.
   * Implementations may use a Scan + in-memory filter or a GSI-based query.
   */
  findConfirmedExpiredReservations(): Promise<ExpiredReservation[]>;

  /**
   * Sets the reservation status to EXPIRED using a conditional UpdateItem.
   * Condition: status = CONFIRMED (idempotent — ConditionalCheckFailedException is silenced).
   */
  markAsExpired(
    reservationId: string,
    areaId: string,
    date: string,
    startTime: string,
  ): Promise<void>;

  /**
   * Decrements currentOccupancy in SlotOccupancyTable for the given slot.
   * Condition: currentOccupancy > 0 (prevents negative values).
   */
  releaseSlotOccupancy(areaId: string, date: string, startTime: string): Promise<void>;
}

export interface ExpireResult {
  /** Total reservations successfully expired in this run. */
  processed: number;
  /** Total reservations that failed to expire due to unexpected errors. */
  errors: number;
  /** List of reservationIds that could not be processed. */
  failedIds: string[];
}

/**
 * Name of the error thrown by DynamoDB when a ConditionExpression fails.
 * Used to detect idempotent re-expiration attempts.
 */
const CONDITIONAL_CHECK_FAILED = 'ConditionalCheckFailedException';

export class ExpireReservationsUseCase {
  constructor(private readonly repository: ExpirationRepository) {}

  async execute(): Promise<ExpireResult> {
    const expired = await this.repository.findConfirmedExpiredReservations();

    let processed = 0;
    let errors = 0;
    const failedIds: string[] = [];

    for (const reservation of expired) {
      try {
        await this.repository.markAsExpired(
          reservation.reservationId,
          reservation.areaId,
          reservation.date,
          reservation.startTime,
        );

        await this.repository.releaseSlotOccupancy(
          reservation.areaId,
          reservation.date,
          reservation.startTime,
        );

        processed++;
      } catch (err: unknown) {
        // ConditionalCheckFailedException means the reservation was already expired
        // by a concurrent run — treat as success (idempotent).
        const name = (err as { name?: string })?.name;
        if (name === CONDITIONAL_CHECK_FAILED) {
          processed++;
          continue;
        }

        console.error(
          `[ExpireReservationsUseCase] Failed to expire reservationId=${reservation.reservationId}`,
          err,
        );
        errors++;
        failedIds.push(reservation.reservationId);
      }
    }

    return { processed, errors, failedIds };
  }
}
