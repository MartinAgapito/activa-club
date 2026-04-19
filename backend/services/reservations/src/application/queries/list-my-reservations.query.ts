import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../domain/repositories/reservation.repository.interface';
import {
  MEMBERS_REPOSITORY,
  MembersRepositoryInterface,
} from '../ports/members.repository.interface';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import { WeeklyQuota } from '../../domain/value-objects/weekly-quota.vo';

/** Weekly reservation limits per membership type (AC-012 domain rule). */
const WEEKLY_LIMITS_BY_MEMBERSHIP: Record<string, number> = {
  Silver: 2,
  Gold: 3,
  VIP: 5,
};

const DEFAULT_WEEKLY_LIMIT = 2;

export interface ListMyReservationsInput {
  memberId: string;
  membershipType: string;
  view: 'upcoming' | 'history';
  limit: number;
  lastKey?: string;
}

export interface ReservationSummaryDto {
  reservationId: string;
  areaId: string;
  areaName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  createdAt: string;
  canCancel: boolean;
}

export interface ListMyReservationsResult {
  weeklyQuota: {
    used: number;
    limit: number;
    resetsAt: string;
  };
  membershipStatus: string;
  items: ReservationSummaryDto[];
  lastKey: string | null;
}

function nextMondayIso(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntilMonday);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}

@Injectable()
export class ListMyReservationsQuery {
  private readonly logger = new Logger(ListMyReservationsQuery.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepositoryInterface,

    @Inject(MEMBERS_REPOSITORY)
    private readonly membersRepo: MembersRepositoryInterface,
  ) {}

  async execute(input: ListMyReservationsInput): Promise<ListMyReservationsResult> {
    this.logger.debug(
      `ListMyReservationsQuery: memberId=${input.memberId} view=${input.view} limit=${input.limit}`,
    );

    // AC-014: Members with inactive memberships can still view their reservations.
    // The endpoint does NOT throw MEMBERSHIP_INACTIVE — it returns membershipStatus
    // so the frontend can display an appropriate banner.
    const member = await this.membersRepo.findById(input.memberId);

    const membershipStatus = member?.accountStatus ?? 'unknown';
    const membershipType = member?.membershipType ?? input.membershipType ?? 'Silver';

    // Determine weekly used count.
    // If the weekly reset date has already passed, the counter is stale — report 0.
    const weeklyResetAt = member?.weeklyResetAt ?? nextMondayIso();
    const now = new Date();
    const weeklyUsed =
      member && now < new Date(weeklyResetAt) ? (member.weeklyReservationCount ?? 0) : 0;

    // Derive weekly limit from the member's membership type.
    const weeklyLimit =
      WEEKLY_LIMITS_BY_MEMBERSHIP[membershipType] ?? DEFAULT_WEEKLY_LIMIT;

    const { items, lastKey } = await this.reservationRepo.listByMember({
      memberId: input.memberId,
      view: input.view,
      limit: input.limit,
      lastKey: input.lastKey,
    });

    const quota = new WeeklyQuota(weeklyUsed, weeklyLimit, weeklyResetAt);
    const nowMs = now.getTime();

    return {
      weeklyQuota: {
        used: quota.used,
        limit: quota.limit,
        resetsAt: quota.resetsAt,
      },
      membershipStatus,
      items: items.map((r) => toSummaryDto(r, nowMs)),
      lastKey,
    };
  }
}

/**
 * Maps a ReservationEntity to the summary DTO for the AC-014 response.
 * `canCancel` is true only when the reservation is CONFIRMED and the
 * cancellation window (2 hours before start) has not yet closed.
 */
function toSummaryDto(r: ReservationEntity, nowMs: number): ReservationSummaryDto {
  const CANCEL_WINDOW_HOURS = 2;
  const startUtc = new Date(`${r.date}T${r.startTime}:00Z`).getTime();
  const canCancel =
    r.status === 'CONFIRMED' && nowMs < startUtc - CANCEL_WINDOW_HOURS * 3600 * 1000;

  return {
    reservationId: r.reservationId,
    areaId: r.areaId,
    areaName: r.areaName,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    durationMinutes: r.durationMinutes,
    status: r.status,
    createdAt: r.createdAt,
    canCancel,
  };
}
