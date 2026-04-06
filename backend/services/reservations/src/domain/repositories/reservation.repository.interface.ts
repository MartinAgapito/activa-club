import { ReservationEntity } from '../entities/reservation.entity';
import { ReservationStatus } from '../value-objects/reservation-status.vo';

export const RESERVATION_REPOSITORY = Symbol('ReservationRepositoryInterface');

export interface ReservationCreatePayload {
  reservationId: string;
  memberId: string;
  memberWeeklyCount: number;
  memberWeeklyResetAt: string;
  needsWeeklyReset: boolean;
  areaId: string;
  areaName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  expiresAt: string;
  slotCapacity: number;
}

export interface ReservationCancelPayload {
  pk: string;
  sk: string;
  memberId: string;
  areaId: string;
  date: string;
  startTime: string;
  cancelReason?: string;
  cancelledByRole: 'MEMBER' | 'MANAGER';
  byManager: boolean;
}

export interface ReservationListOptions {
  memberId: string;
  view: 'upcoming' | 'history';
  limit: number;
  lastKey?: string;
}

export interface ReservationListResult {
  items: ReservationEntity[];
  lastKey: string | null;
}

/**
 * Repository interface for the ReservationsTable.
 *
 * The domain layer depends exclusively on this interface — no AWS SDK
 * knowledge leaks into use cases.
 */
export interface ReservationRepositoryInterface {
  /**
   * Resolves reservationId → { pk, sk } using GSI_ReservationId.
   * Returns null when the reservationId is not found.
   */
  findKeysByReservationId(reservationId: string): Promise<{ pk: string; sk: string } | null>;

  /** Fetches the full reservation item by its primary key pair. */
  findByKey(pk: string, sk: string): Promise<ReservationEntity | null>;

  /**
   * Queries GSI_Member for all reservations belonging to a member.
   * Supports cursor-based pagination via lastKey.
   */
  listByMember(options: ReservationListOptions): Promise<ReservationListResult>;

  /**
   * Queries GSI_AreaDate for all reservations on a given area and date.
   * Used by the manager calendar view and block conflict detection.
   */
  listByAreaAndDate(areaId: string, date: string): Promise<ReservationEntity[]>;

  /**
   * Queries GSI_StatusExpires for CONFIRMED reservations with expires_at <= threshold.
   * Used by the expirer Lambda (AC-016).
   */
  findExpiredConfirmed(thresholdIso: string): Promise<ReservationEntity[]>;

  /**
   * Creates a new reservation via DynamoDB TransactWrite.
   * Transaction includes:
   *   - ConditionCheck + UpdateItem on SlotOccupancyTable (occupancy < capacity)
   *   - PutItem on ReservationsTable
   *   - UpdateItem on MembersTable (weekly count)
   *
   * Throws SlotFullException on TransactionCanceledException with ConditionalCheckFailed.
   */
  createWithTransaction(payload: ReservationCreatePayload): Promise<ReservationEntity>;

  /**
   * Cancels a reservation via DynamoDB TransactWrite.
   * Transaction includes:
   *   - UpdateItem on ReservationsTable (status = CANCELLED, conditionCheck status = CONFIRMED)
   *   - UpdateItem on SlotOccupancyTable (occupancy--)
   *   - UpdateItem on MembersTable (weeklyReservationCount--)
   */
  cancelWithTransaction(payload: ReservationCancelPayload): Promise<void>;

  /**
   * Expires a single reservation (used by AC-016 expirer).
   * Uses a separate TransactWrite with status = CONFIRMED condition.
   * Returns true if expired, false if already transitioned (idempotent).
   */
  expireWithTransaction(
    pk: string,
    sk: string,
    areaId: string,
    date: string,
    startTime: string,
  ): Promise<boolean>;

  /**
   * Sets status to CANCELLED for multiple reservations in a batch.
   * Used by the create-area-block command when confirmForce = true.
   * Each cancellation also decrements SlotOccupancyTable and MembersTable.
   */
  batchCancelWithTransaction(
    reservations: Array<{
      pk: string;
      sk: string;
      memberId: string;
      areaId: string;
      date: string;
      startTime: string;
    }>,
    reason: string,
  ): Promise<void>;
}
