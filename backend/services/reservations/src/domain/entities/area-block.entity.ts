export interface AreaBlockEntityProps {
  blockId: string;
  areaId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

/**
 * AreaBlock domain entity.
 *
 * Represents a manager-created time block on an area (maintenance window,
 * special event, etc.). Blocks are treated as virtual reservations that
 * consume all available slots for the blocked time range.
 */
export class AreaBlockEntity {
  readonly blockId: string;
  readonly areaId: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly reason: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly isActive: boolean;

  constructor(props: AreaBlockEntityProps) {
    this.blockId = props.blockId;
    this.areaId = props.areaId;
    this.date = props.date;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.reason = props.reason;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.isActive = props.isActive;
  }

  /**
   * Returns true if this block overlaps with the given HH:MM time range.
   */
  overlapsRange(startTime: string, endTime: string): boolean {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return toMin(this.startTime) < toMin(endTime) && toMin(this.endTime) > toMin(startTime);
  }
}
