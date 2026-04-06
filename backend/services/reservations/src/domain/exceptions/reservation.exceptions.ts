/**
 * Domain exceptions for the Reservations service.
 *
 * These classes contain no HTTP knowledge — status code mapping happens
 * in the GlobalExceptionFilter at the infrastructure boundary.
 */

// ─── AC-011: Availability Exceptions ─────────────────────────────────────────

export class InvalidDateFormatException extends Error {
  readonly code = 'INVALID_DATE_FORMAT';
  constructor() {
    super('The date parameter must be in YYYY-MM-DD format.');
    this.name = 'InvalidDateFormatException';
  }
}

export class DateInPastException extends Error {
  readonly code = 'DATE_IN_PAST';
  constructor() {
    super('The requested date is in the past.');
    this.name = 'DateInPastException';
  }
}

export class DateExceedsWindowException extends Error {
  readonly code = 'DATE_EXCEEDS_WINDOW';
  constructor() {
    super('Members may only book up to 7 days in advance.');
    this.name = 'DateExceedsWindowException';
  }
}

export class MembershipInactiveException extends Error {
  readonly code = 'MEMBERSHIP_INACTIVE';
  constructor() {
    super('Your membership is not active. Please contact club administration.');
    this.name = 'MembershipInactiveException';
  }
}

export class AreaNotAccessibleException extends Error {
  readonly code = 'AREA_NOT_ACCESSIBLE';
  constructor() {
    super('Your membership type does not include access to this area.');
    this.name = 'AreaNotAccessibleException';
  }
}

export class AreaNotFoundException extends Error {
  readonly code = 'AREA_NOT_FOUND';
  constructor() {
    super('The requested area does not exist or is not active.');
    this.name = 'AreaNotFoundException';
  }
}

// ─── AC-012: Create Reservation Exceptions ───────────────────────────────────

export class InvalidStartTimeException extends Error {
  readonly code = 'INVALID_START_TIME';
  constructor() {
    super('The start time does not align with the area slot boundaries.');
    this.name = 'InvalidStartTimeException';
  }
}

export class DurationExceedsMaximumException extends Error {
  readonly code = 'DURATION_EXCEEDS_MAXIMUM';
  constructor(maxMinutes: number) {
    super(
      `The requested duration exceeds the maximum allowed for your membership type (${maxMinutes} minutes).`,
    );
    this.name = 'DurationExceedsMaximumException';
  }
}

export class DurationNotMultipleException extends Error {
  readonly code = 'DURATION_NOT_MULTIPLE';
  constructor(slotDuration: number) {
    super(`The duration must be a multiple of the area slot duration (${slotDuration} minutes).`);
    this.name = 'DurationNotMultipleException';
  }
}

export class WeeklyQuotaExceededException extends Error {
  readonly code = 'WEEKLY_QUOTA_EXCEEDED';
  constructor() {
    super('You have reached your weekly reservation limit.');
    this.name = 'WeeklyQuotaExceededException';
  }
}

export class SlotFullException extends Error {
  readonly code = 'SLOT_FULL';
  constructor() {
    super('This time slot is fully booked. Please choose a different time.');
    this.name = 'SlotFullException';
  }
}

export class OverlapConflictException extends Error {
  readonly code = 'OVERLAP_CONFLICT';
  constructor() {
    super('You already have a confirmed reservation that overlaps with this time slot.');
    this.name = 'OverlapConflictException';
  }
}

// ─── AC-013: Cancel Reservation Exceptions ───────────────────────────────────

export class ReservationNotFoundException extends Error {
  readonly code = 'RESERVATION_NOT_FOUND';
  constructor() {
    super('The requested reservation does not exist.');
    this.name = 'ReservationNotFoundException';
  }
}

export class ForbiddenReservationException extends Error {
  readonly code = 'FORBIDDEN';
  constructor() {
    super('You are not authorised to cancel this reservation.');
    this.name = 'ForbiddenReservationException';
  }
}

export class CancellationWindowClosedException extends Error {
  readonly code = 'CANCELLATION_WINDOW_CLOSED';
  constructor() {
    super('Cancellations are not allowed within 2 hours of the reservation start time.');
    this.name = 'CancellationWindowClosedException';
  }
}

export class InvalidReservationStatusException extends Error {
  readonly code = 'INVALID_STATUS';
  constructor() {
    super('This reservation has already been cancelled or has expired.');
    this.name = 'InvalidReservationStatusException';
  }
}

// ─── AC-015: Block Exceptions ─────────────────────────────────────────────────

export class BlockNotFoundException extends Error {
  readonly code = 'BLOCK_NOT_FOUND';
  constructor() {
    super('The requested block does not exist or is already inactive.');
    this.name = 'BlockNotFoundException';
  }
}

export class BlockOverlapException extends Error {
  readonly code = 'BLOCK_OVERLAP';
  constructor() {
    super('An active block already covers part of the requested time range.');
    this.name = 'BlockOverlapException';
  }
}

export class InvalidBlockRangeException extends Error {
  readonly code = 'INVALID_BLOCK_RANGE';
  constructor() {
    super('The block range is invalid. endTime must be after startTime and within area schedule.');
    this.name = 'InvalidBlockRangeException';
  }
}

export class ReasonRequiredException extends Error {
  readonly code = 'REASON_REQUIRED';
  constructor() {
    super('A reason of at least 10 characters is required to cancel a reservation as manager.');
    this.name = 'ReasonRequiredException';
  }
}
