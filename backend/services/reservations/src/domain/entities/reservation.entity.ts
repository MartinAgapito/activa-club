import { ReservationStatus } from '../value-objects/reservation-status.vo';

export interface ReservationEntityProps {
  reservationId: string;
  memberId: string;
  areaId: string;
  areaName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: ReservationStatus;
  cancelReason?: string;
  cancelledByRole?: 'MEMBER' | 'MANAGER';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/**
 * Reservation domain entity.
 *
 * Represents a single reservation record. Contains only domain state and
 * behaviour — no NestJS or AWS SDK dependencies.
 *
 * Lifecycle: CONFIRMED → CANCELLED | EXPIRED
 */
export class ReservationEntity {
  readonly reservationId: string;
  readonly memberId: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMinutes: number;
  readonly status: ReservationStatus;
  readonly cancelReason?: string;
  readonly cancelledByRole?: 'MEMBER' | 'MANAGER';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;

  constructor(props: ReservationEntityProps) {
    this.reservationId = props.reservationId;
    this.memberId = props.memberId;
    this.areaId = props.areaId;
    this.areaName = props.areaName;
    this.date = props.date;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.durationMinutes = props.durationMinutes;
    this.status = props.status;
    this.cancelReason = props.cancelReason;
    this.cancelledByRole = props.cancelledByRole;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.expiresAt = props.expiresAt;
  }

  isConfirmed(): boolean {
    return this.status === ReservationStatus.CONFIRMED;
  }

  isCancellable(): boolean {
    return this.status === ReservationStatus.CONFIRMED;
  }

  /**
   * Returns the UTC datetime string of the reservation start (date + startTime).
   * Assumes the area operates in UTC for MVP purposes.
   */
  getStartDateTimeUtc(): Date {
    return new Date(`${this.date}T${this.startTime}:00Z`);
  }

  /**
   * Returns true if cancellation is still allowed given the current time
   * and the area's cancel window in hours.
   */
  isCancellationWindowOpen(now: Date, cancelWindowHours: number): boolean {
    const startUtc = this.getStartDateTimeUtc();
    const windowMs = cancelWindowHours * 60 * 60 * 1000;
    return now.getTime() < startUtc.getTime() - windowMs;
  }
}
