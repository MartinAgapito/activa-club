import { SlotOccupancy } from '../value-objects/slot-occupancy.vo';

export const SLOT_OCCUPANCY_REPOSITORY = Symbol('SlotOccupancyRepositoryInterface');

/**
 * Repository interface for SlotOccupancyTable.
 *
 * Provides read-only access to occupancy data for availability queries (AC-011).
 * Write operations are performed atomically inside ReservationRepository.createWithTransaction
 * and cancelWithTransaction to guarantee consistency.
 */
export interface SlotOccupancyRepositoryInterface {
  /**
   * Fetches the occupancy record for a single slot.
   * Returns a default SlotOccupancy(0, capacity) when no record exists yet.
   *
   * @param areaId  ULID of the area
   * @param date    YYYY-MM-DD
   * @param startTime HH:MM
   * @param capacity  Area capacity (used if the slot record does not exist yet)
   */
  getSlotOccupancy(
    areaId: string,
    date: string,
    startTime: string,
    capacity: number,
  ): Promise<SlotOccupancy>;

  /**
   * Fetches occupancy records for all provided slots in a single BatchGetItem.
   * Returns a map keyed by startTime.
   */
  batchGetSlotOccupancies(
    areaId: string,
    date: string,
    startTimes: string[],
    capacity: number,
  ): Promise<Map<string, SlotOccupancy>>;
}
