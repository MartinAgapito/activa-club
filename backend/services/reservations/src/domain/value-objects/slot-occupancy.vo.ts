/**
 * SlotOccupancy value object.
 *
 * Holds the current occupancy state of a single area+date+startTime slot.
 * The `available` count is derived (capacity - occupancy), floored at 0.
 */
export class SlotOccupancy {
  readonly occupancy: number;
  readonly capacity: number;

  constructor(occupancy: number, capacity: number) {
    if (occupancy < 0) throw new Error('occupancy cannot be negative');
    if (capacity <= 0) throw new Error('capacity must be a positive integer');
    this.occupancy = occupancy;
    this.capacity = capacity;
  }

  get available(): number {
    return Math.max(0, this.capacity - this.occupancy);
  }

  get isFull(): boolean {
    return this.occupancy >= this.capacity;
  }
}
