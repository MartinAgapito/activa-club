/**
 * Area domain entity.
 *
 * Represents a physical area in the club (e.g., tennis court, pool).
 * Contains only domain state and behaviour — no NestJS or AWS SDK dependencies.
 *
 * AC-011
 */
export interface AreaEntityProps {
  areaId: string;
  areaName: string;
  capacity: number;
  allowedMemberships: string[];
  openingTime: string; // HH:MM
  closingTime: string; // HH:MM
  status: string;
}

export class AreaEntity {
  readonly areaId: string;
  readonly areaName: string;
  readonly capacity: number;
  readonly allowedMemberships: string[];
  readonly openingTime: string;
  readonly closingTime: string;
  readonly status: string;

  constructor(props: AreaEntityProps) {
    this.areaId = props.areaId;
    this.areaName = props.areaName;
    this.capacity = props.capacity;
    this.allowedMemberships = props.allowedMemberships;
    this.openingTime = props.openingTime;
    this.closingTime = props.closingTime;
    this.status = props.status;
  }

  isActive(): boolean {
    return this.status === 'Active';
  }

  isAccessibleByMembership(membershipType: string): boolean {
    return this.allowedMemberships.includes(membershipType);
  }

  /**
   * Generates all hourly slot start times for the area's operating hours.
   * e.g., openingTime=09:00, closingTime=22:00 → ["09:00","10:00",...,"21:00"]
   */
  getSlotStartTimes(): string[] {
    const slots: string[] = [];
    const [openHour] = this.openingTime.split(':').map(Number);
    const [closeHour] = this.closingTime.split(':').map(Number);

    for (let hour = openHour; hour < closeHour; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
    }

    return slots;
  }
}
