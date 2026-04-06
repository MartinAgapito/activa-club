import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../domain/repositories/reservation.repository.interface';
import {
  AREA_BLOCK_REPOSITORY,
  AreaBlockRepositoryInterface,
} from '../../domain/repositories/area-block.repository.interface';
import { AREAS_REPOSITORY, AreasRepositoryInterface } from '../ports/areas.repository.interface';
import { TimeSlot } from '../../domain/value-objects/time-slot.vo';
import { ReservationEntity } from '../../domain/entities/reservation.entity';

export interface GetManagerCalendarInput {
  date: string;
  areaId?: string;
}

export interface ManagerSlotDto {
  startTime: string;
  endTime: string;
  occupancy: number;
  capacity: number;
  blocked: boolean;
  blockId?: string;
  blockReason?: string;
  reservations: Array<{
    reservationId: string;
    memberId: string;
    memberName?: string;
    status: string;
  }>;
}

export interface ManagerAreaDto {
  areaId: string;
  areaName: string;
  capacity: number;
  occupancyPercentage: number;
  slots: ManagerSlotDto[];
}

export interface GetManagerCalendarResult {
  date: string;
  areas: ManagerAreaDto[];
}

@Injectable()
export class GetManagerCalendarQuery {
  private readonly logger = new Logger(GetManagerCalendarQuery.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepositoryInterface,

    @Inject(AREA_BLOCK_REPOSITORY)
    private readonly areaBlockRepo: AreaBlockRepositoryInterface,

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  async execute(input: GetManagerCalendarInput): Promise<GetManagerCalendarResult> {
    this.logger.debug(
      `GetManagerCalendarQuery: date=${input.date} areaId=${input.areaId ?? 'all'}`,
    );

    // Load areas to process
    const areaList = input.areaId
      ? [await this.areasRepo.findById(input.areaId)].filter(Boolean)
      : await this.areasRepo.findAllActive();

    const areasResult: ManagerAreaDto[] = [];

    for (const area of areaList) {
      if (!area) continue;

      const slotStartTimes = generateSlotStartTimes(
        area.openingTime,
        area.closingTime,
        area.slotDuration,
      );

      const [reservations, blocks] = await Promise.all([
        this.reservationRepo.listByAreaAndDate(area.areaId, input.date),
        this.areaBlockRepo.listByAreaAndDate(area.areaId, input.date),
      ]);

      const confirmedReservations = reservations.filter((r) => r.status === ('CONFIRMED' as any));

      let totalOccupancy = 0;
      let totalCapacity = 0;

      const slots: ManagerSlotDto[] = slotStartTimes.map((startTime) => {
        const endTime = TimeSlot.computeEndTime(startTime, area.slotDuration);

        const slotReservations = reservations.filter((r) => {
          const rStart = TimeSlot.toMinutes(r.startTime);
          const rEnd = TimeSlot.toMinutes(r.endTime);
          const sStart = TimeSlot.toMinutes(startTime);
          const sEnd = TimeSlot.toMinutes(endTime);
          return rStart < sEnd && rEnd > sStart;
        });

        const activeBlock = blocks.find((b) => b.isActive && b.overlapsRange(startTime, endTime));

        const confirmedInSlot = slotReservations.filter((r) => r.status === ('CONFIRMED' as any));
        totalOccupancy += confirmedInSlot.length;
        totalCapacity += area.capacity;

        return {
          startTime,
          endTime,
          occupancy: confirmedInSlot.length,
          capacity: area.capacity,
          blocked: !!activeBlock,
          blockId: activeBlock?.blockId,
          blockReason: activeBlock?.reason,
          reservations: slotReservations.map((r) => ({
            reservationId: r.reservationId,
            memberId: r.memberId,
            status: r.status,
          })),
        };
      });

      const occupancyPercentage =
        totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

      areasResult.push({
        areaId: area.areaId,
        areaName: area.name,
        capacity: area.capacity,
        occupancyPercentage,
        slots,
      });
    }

    return { date: input.date, areas: areasResult };
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
