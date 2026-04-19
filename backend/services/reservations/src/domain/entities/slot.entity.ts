/**
 * Slot domain entity.
 *
 * Represents a single hourly time slot for an area on a given date.
 * Computed from SlotOccupancyTable and AreaBlocksTable records.
 *
 * AC-011
 */

export type SlotStatus = 'AVAILABLE' | 'FULL' | 'BLOCKED';

export interface SlotEntityProps {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  occupancy: number;
  capacity: number;
  blocked: boolean;
}

export class SlotEntity {
  readonly startTime: string;
  readonly endTime: string;
  readonly occupancy: number;
  readonly capacity: number;
  readonly blocked: boolean;

  constructor(props: SlotEntityProps) {
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.occupancy = props.occupancy;
    this.capacity = props.capacity;
    this.blocked = props.blocked;
  }

  get available(): number {
    if (this.blocked) return 0;
    return Math.max(0, this.capacity - this.occupancy);
  }

  get status(): SlotStatus {
    if (this.blocked) return 'BLOCKED';
    if (this.available === 0) return 'FULL';
    return 'AVAILABLE';
  }
}
