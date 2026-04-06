import { Injectable, Inject, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { CreateReservationCommand } from './create-reservation.command';
import { CreateReservationResult } from './create-reservation.result';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../../domain/repositories/reservation.repository.interface';
import { AREAS_REPOSITORY, AreasRepositoryInterface } from '../../ports/areas.repository.interface';
import {
  MEMBERS_REPOSITORY,
  MembersRepositoryInterface,
} from '../../ports/members.repository.interface';
import {
  AreaNotFoundException,
  MembershipInactiveException,
  AreaNotAccessibleException,
  DateInPastException,
  DateExceedsWindowException,
  InvalidStartTimeException,
  DurationExceedsMaximumException,
  DurationNotMultipleException,
  WeeklyQuotaExceededException,
  OverlapConflictException,
} from '../../../domain/exceptions/reservation.exceptions';
import { TimeSlot } from '../../../domain/value-objects/time-slot.vo';
import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MEMBER_BOOKING_WINDOW_DAYS = 7;

@Injectable()
export class CreateReservationHandler {
  private readonly logger = new Logger(CreateReservationHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepositoryInterface,

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,

    @Inject(MEMBERS_REPOSITORY)
    private readonly membersRepo: MembersRepositoryInterface,
  ) {}

  async execute(command: CreateReservationCommand): Promise<CreateReservationResult> {
    this.logger.log(
      `CreateReservationHandler: memberId=${command.memberId} areaId=${command.areaId} date=${command.date} startTime=${command.startTime} durationMinutes=${command.durationMinutes}`,
    );

    // ── Step 1: Validate date ───────────────────────────────────────────────
    if (!DATE_REGEX.test(command.date)) {
      throw new DateInPastException();
    }

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const requestedDate = new Date(`${command.date}T00:00:00Z`);

    if (requestedDate < todayUtc) {
      throw new DateInPastException();
    }

    const windowEnd = new Date(todayUtc);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + MEMBER_BOOKING_WINDOW_DAYS);
    if (requestedDate > windowEnd) {
      throw new DateExceedsWindowException();
    }

    // ── Step 2: Load area config ────────────────────────────────────────────
    const area = await this.areasRepo.findById(command.areaId);
    if (!area || area.status !== 'Active') {
      throw new AreaNotFoundException();
    }

    // ── Step 3: Load member profile ─────────────────────────────────────────
    const member = await this.membersRepo.findById(command.memberId);
    if (!member || member.accountStatus !== 'active') {
      throw new MembershipInactiveException();
    }

    // ── Step 4: Membership access check ────────────────────────────────────
    if (!area.allowedMemberships.includes(command.membershipType)) {
      throw new AreaNotAccessibleException();
    }

    // ── Step 5: Validate start time aligns to slot boundary ─────────────────
    const slotStartTimes = generateSlotStartTimes(
      area.openingTime,
      area.closingTime,
      area.slotDuration,
    );
    if (!slotStartTimes.includes(command.startTime)) {
      throw new InvalidStartTimeException();
    }

    // ── Step 6: Validate duration ───────────────────────────────────────────
    const maxDuration =
      (area.maxDurationMinutes as Record<string, number>)[command.membershipType] ?? 0;
    if (command.durationMinutes > maxDuration) {
      throw new DurationExceedsMaximumException(maxDuration);
    }
    if (command.durationMinutes % area.slotDuration !== 0) {
      throw new DurationNotMultipleException(area.slotDuration);
    }

    // ── Step 7: Check weekly quota ──────────────────────────────────────────
    const weeklyLimit = (area.weeklyLimit as Record<string, number>)[command.membershipType] ?? 0;
    const now = new Date();
    const weeklyResetAt = member.weeklyResetAt ? new Date(member.weeklyResetAt) : new Date(0);
    const needsWeeklyReset = now >= weeklyResetAt;
    const effectiveWeeklyCount = needsWeeklyReset ? 0 : (member.weeklyReservationCount ?? 0);

    if (effectiveWeeklyCount >= weeklyLimit) {
      throw new WeeklyQuotaExceededException();
    }

    // ── Step 8: Check for overlapping reservations ──────────────────────────
    const endTime = TimeSlot.computeEndTime(command.startTime, command.durationMinutes);
    const memberReservations = await this.reservationRepo.listByMember({
      memberId: command.memberId,
      view: 'upcoming',
      limit: 100,
    });

    const requestedSlot = new TimeSlot(command.startTime, endTime);
    const hasOverlap = memberReservations.items.some((r) => {
      if (r.date !== command.date) return false;
      if (r.status !== ReservationStatus.CONFIRMED) return false;
      try {
        const existingSlot = new TimeSlot(r.startTime, r.endTime);
        return requestedSlot.overlaps(existingSlot);
      } catch {
        return false;
      }
    });

    if (hasOverlap) {
      throw new OverlapConflictException();
    }

    // ── Step 9: Generate IDs and timestamps ────────────────────────────────
    const reservationId = ulid();
    const nowIso = now.toISOString();
    const expiresAt = new Date(`${command.date}T${endTime}:00Z`).toISOString();

    // Next Monday 00:00 UTC for weekly reset
    const nextMonday = getNextMondayIso();

    // ── Step 10: TransactWrite ──────────────────────────────────────────────
    const reservation = await this.reservationRepo.createWithTransaction({
      reservationId,
      memberId: command.memberId,
      memberWeeklyCount: effectiveWeeklyCount,
      memberWeeklyResetAt: nextMonday,
      needsWeeklyReset,
      areaId: command.areaId,
      areaName: area.name,
      date: command.date,
      startTime: command.startTime,
      endTime,
      durationMinutes: command.durationMinutes,
      expiresAt,
      slotCapacity: area.capacity,
    });

    this.logger.log(
      `CreateReservationHandler: created reservationId=${reservationId} for memberId=${command.memberId}`,
    );

    return new CreateReservationResult(
      reservation.reservationId,
      reservation.areaId,
      reservation.areaName,
      reservation.date,
      reservation.startTime,
      reservation.endTime,
      reservation.durationMinutes,
      reservation.status,
      reservation.createdAt,
    );
  }
}

function generateSlotStartTimes(
  openingTime: string,
  closingTime: string,
  slotDuration: number,
): string[] {
  const slots: string[] = [];
  let current = TimeSlot.toMinutes(openingTime);
  const closing = TimeSlot.toMinutes(closingTime);

  while (current + slotDuration <= closing) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += slotDuration;
  }

  return slots;
}

function getNextMondayIso(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntilMonday);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}
