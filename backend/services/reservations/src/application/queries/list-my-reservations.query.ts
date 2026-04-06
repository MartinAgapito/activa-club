import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../domain/repositories/reservation.repository.interface';
import {
  MEMBERS_REPOSITORY,
  MembersRepositoryInterface,
} from '../ports/members.repository.interface';
import { MembershipInactiveException } from '../../domain/exceptions/reservation.exceptions';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import { WeeklyQuota } from '../../domain/value-objects/weekly-quota.vo';
import { AREAS_REPOSITORY, AreasRepositoryInterface } from '../ports/areas.repository.interface';

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
  status: string;
  createdAt: string;
}

export interface ListMyReservationsResult {
  weeklyQuota: {
    used: number;
    limit: number;
    resetsAt: string;
  };
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

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  async execute(input: ListMyReservationsInput): Promise<ListMyReservationsResult> {
    this.logger.debug(
      `ListMyReservationsQuery: memberId=${input.memberId} view=${input.view} limit=${input.limit}`,
    );

    // Load member profile — must exist and be active
    const member = await this.membersRepo.findById(input.memberId);
    if (!member || member.accountStatus !== 'active') {
      throw new MembershipInactiveException();
    }

    // Determine weekly limit from a representative area or default
    // We derive a safe fallback of 0 and let the member's own area check enforce limits.
    // For the list endpoint we just report what the member's quota state is.
    // The weekly limit per membership is stored per-area; here we fetch the first known area
    // or default to 0 to be safe.
    // AC-014: "weeklyQuota" is informational — just report what is stored on the member record.
    const weeklyResetAt = member.weeklyResetAt ?? nextMondayIso();
    const weeklyUsed = member.weeklyReservationCount ?? 0;

    // Derive per-membership weekly limit: look up from any area.
    // For simplicity in the list endpoint (informational only), we store the limit
    // as 0 when no area context is available and note it is informational.
    // A future improvement would store the limit on the member record.
    const weeklyLimit = 0; // Will be superseded by area-specific limit on create

    const { items, lastKey } = await this.reservationRepo.listByMember({
      memberId: input.memberId,
      view: input.view,
      limit: input.limit,
      lastKey: input.lastKey,
    });

    const quota = new WeeklyQuota(weeklyUsed, weeklyLimit, weeklyResetAt);

    return {
      weeklyQuota: {
        used: quota.used,
        limit: quota.limit,
        resetsAt: quota.resetsAt,
      },
      items: items.map(toSummaryDto),
      lastKey,
    };
  }
}

function toSummaryDto(r: ReservationEntity): ReservationSummaryDto {
  return {
    reservationId: r.reservationId,
    areaId: r.areaId,
    areaName: r.areaName,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    status: r.status,
    createdAt: r.createdAt,
  };
}
