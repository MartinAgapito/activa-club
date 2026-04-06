/**
 * TimeSlot value object.
 *
 * Represents a bounded time range within a single day using HH:MM 24-hour format.
 * Used for slot boundary validation and overlap detection.
 */
export class TimeSlot {
  readonly startTime: string; // HH:MM
  readonly endTime: string; // HH:MM

  constructor(startTime: string, endTime: string) {
    TimeSlot.assertValidFormat(startTime);
    TimeSlot.assertValidFormat(endTime);

    if (TimeSlot.toMinutes(endTime) <= TimeSlot.toMinutes(startTime)) {
      throw new Error(`endTime (${endTime}) must be after startTime (${startTime})`);
    }

    this.startTime = startTime;
    this.endTime = endTime;
  }

  /** Returns the duration in minutes. */
  get durationMinutes(): number {
    return TimeSlot.toMinutes(this.endTime) - TimeSlot.toMinutes(this.startTime);
  }

  /** Returns true if this slot overlaps with another. */
  overlaps(other: TimeSlot): boolean {
    return (
      TimeSlot.toMinutes(this.startTime) < TimeSlot.toMinutes(other.endTime) &&
      TimeSlot.toMinutes(this.endTime) > TimeSlot.toMinutes(other.startTime)
    );
  }

  /** Returns true if this slot contains the given HH:MM start time. */
  containsStart(startTime: string): boolean {
    const t = TimeSlot.toMinutes(startTime);
    return t >= TimeSlot.toMinutes(this.startTime) && t < TimeSlot.toMinutes(this.endTime);
  }

  /** Computes the end time given a start time and duration in minutes. */
  static computeEndTime(startTime: string, durationMinutes: number): string {
    const totalMinutes = TimeSlot.toMinutes(startTime) + durationMinutes;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Converts HH:MM to total minutes since midnight. */
  static toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /** Validates HH:MM format. */
  static isValidFormat(time: string): boolean {
    return /^\d{2}:\d{2}$/.test(time);
  }

  private static assertValidFormat(time: string): void {
    if (!TimeSlot.isValidFormat(time)) {
      throw new Error(`Invalid time format: "${time}". Expected HH:MM.`);
    }
  }
}
