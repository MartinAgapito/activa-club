/**
 * WeeklyQuota value object.
 *
 * Tracks how many reservations a member has created in the current ISO week.
 * `resetsAt` is the ISO-8601 UTC timestamp of the next Monday 00:00 UTC.
 */
export class WeeklyQuota {
  readonly used: number;
  readonly limit: number;
  readonly resetsAt: string;

  constructor(used: number, limit: number, resetsAt: string) {
    this.used = used;
    this.limit = limit;
    this.resetsAt = resetsAt;
  }

  get exhausted(): boolean {
    return this.used >= this.limit;
  }
}
