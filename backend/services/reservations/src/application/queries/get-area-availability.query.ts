import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../domain/repositories/reservation.repository.interface';
import {
  SLOT_OCCUPANCY_REPOSITORY,
  SlotOccupancyRepositoryInterface,
} from '../../domain/repositories/slot-occupancy.repository.interface';
import {
  AREA_BLOCK_REPOSITORY,
  AreaBlockRepositoryInterface,
} from '../../domain/repositories/area-block.repository.interface';
import {
  AreaNotFoundException,
  DateInPastException,
  DateExceedsWindowException,
  MembershipInactiveException,
  AreaNotAccessibleException,
  InvalidDateFormatException,
} from '../../domain/exceptions/reservation.exceptions';
import { WeeklyQuota } from '../../domain/value-objects/weekly-quota.vo';
import { AREAS_REPOSITORY, AreasRepositoryInterface } from '../ports/areas.repository.interface';
import {
  MEMBERS_REPOSITORY,
  MembersRepositoryInterface,
} from '../ports/members.repository.interface';
import { TimeSlot } from '../../domain/value-objects/time-slot.vo';

export interface GetAreaAvailabilityInput {
  areaId: string;
  date: string;
  callerMemberId: string;
  callerRole: string;
  callerMembershipType: string;
}

export interface SlotAvailabilityDto {
  startTime: string;
  endTime: string;
  available: number;
  total: number;
  status: 'AVAILABLE' | 'FULL' | 'BLOCKED';
  blocked: boolean;
  blockReason?: string;
}

export interface GetAreaAvailabilityResult {
  areaId: string;
  areaName: string;
  date: string;
  capacity: number;
  weeklyQuotaInfo?: {
    used: number;
    limit: number;
    exhausted: boolean;
  };
  slots: SlotAvailabilityDto[];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MEMBER_BOOKING_WINDOW_DAYS = 7;

@Injectable()
export class GetAreaAvailabilityQuery {
  private readonly logger = new Logger(GetAreaAvailabilityQuery.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepositoryInterface,

    @Inject(SLOT_OCCUPANCY_REPOSITORY)
    private readonly slotOccupancyRepo: SlotOccupancyRepositoryInterface,

    @Inject(AREA_BLOCK_REPOSITORY)
    private readonly areaBlockRepo: AreaBlockRepositoryInterface,

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,

    @Inject(MEMBERS_REPOSITORY)
    private readonly membersRepo: MembersRepositoryInterface,
  ) {}

  async execute(input: GetAreaAvailabilityInput): Promise<GetAreaAvailabilityResult> {
    this.logger.debug(
      `GetAreaAvailabilityQuery: areaId=${input.areaId} date=${input.date} role=${input.callerRole}`,
    );

    // ── 1. Validate date format ─────────────────────────────────────────────
    if (!DATE_REGEX.test(input.date)) {
      throw new InvalidDateFormatException();
    }

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const requestedDate = new Date(`${input.date}T00:00:00Z`);

    if (requestedDate < todayUtc) {
      throw new DateInPastException();
    }

    const isMemberRole = input.callerRole === 'Member';
    if (isMemberRole) {
      const windowEnd = new Date(todayUtc);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + MEMBER_BOOKING_WINDOW_DAYS);
      if (requestedDate > windowEnd) {
        throw new DateExceedsWindowException();
      }
    }

    // ── 2. Load area ────────────────────────────────────────────────────────
    const area = await this.areasRepo.findById(input.areaId);
    if (!area || area.status !== 'Active') {
      throw new AreaNotFoundException();
    }

    // ── 3. Check membership access (Members only) ───────────────────────────
    let weeklyQuotaInfo: GetAreaAvailabilityResult['weeklyQuotaInfo'] | undefined;

    if (isMemberRole) {
      const member = await this.membersRepo.findById(input.callerMemberId);
      if (!member || member.accountStatus !== 'active') {
        throw new MembershipInactiveException();
      }

      if (!area.allowedMemberships.includes(input.callerMembershipType)) {
        throw new AreaNotAccessibleException();
      }

      const weeklyLimit =
        (area.weeklyLimit as Record<string, number>)[input.callerMembershipType] ?? 0;
      const weeklyReset = member.weeklyResetAt ?? this.nextMondayIso();
      const weeklyUsed = member.weeklyReservationCount ?? 0;

      const quota = new WeeklyQuota(weeklyUsed, weeklyLimit, weeklyReset);
      weeklyQuotaInfo = {
        used: quota.used,
        limit: quota.limit,
        exhausted: quota.exhausted,
      };
    }

    // ── 4. Generate slot list from area schedule ────────────────────────────
    const slotStartTimes = this.generateSlotStartTimes(
      area.openingTime,
      area.closingTime,
      area.slotDuration,
    );

    // ── 5. Load occupancy records (BatchGetItem) ────────────────────────────
    const occupancyMap = await this.slotOccupancyRepo.batchGetSlotOccupancies(
      input.areaId,
      input.date,
      slotStartTimes,
      area.capacity,
    );

    // ── 6. Load active blocks for this area+date ────────────────────────────
    const blocks = await this.areaBlockRepo.listByAreaAndDate(input.areaId, input.date);

    // ── 7. Build slot list ──────────────────────────────────────────────────
    const slots: SlotAvailabilityDto[] = slotStartTimes.map((startTime) => {
      const endTime = TimeSlot.computeEndTime(startTime, area.slotDuration);
      const occupancy = occupancyMap.get(startTime);
      const available = occupancy ? occupancy.available : area.capacity;
      const total = area.capacity;

      const activeBlock = blocks.find((b) => b.isActive && b.overlapsRange(startTime, endTime));

      if (activeBlock) {
        return {
          startTime,
          endTime,
          available: 0,
          total,
          status: 'BLOCKED',
          blocked: true,
          blockReason: activeBlock.reason,
        };
      }

      return {
        startTime,
        endTime,
        available,
        total,
        status: available === 0 ? 'FULL' : 'AVAILABLE',
        blocked: false,
      };
    });

    return {
      areaId: area.areaId,
      areaName: area.name,
      date: input.date,
      capacity: area.capacity,
      weeklyQuotaInfo,
      slots,
    };
  }

  private generateSlotStartTimes(
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

  private nextMondayIso(): string {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    next.setUTCHours(0, 0, 0, 0);
    return next.toISOString();
  }
}
