import { Injectable, Inject, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { CreateAreaBlockCommand } from './create-area-block.command';
import { CreateAreaBlockOutcome } from './create-area-block.result';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../../domain/repositories/reservation.repository.interface';
import {
  AREA_BLOCK_REPOSITORY,
  AreaBlockRepositoryInterface,
} from '../../../domain/repositories/area-block.repository.interface';
import { AREAS_REPOSITORY, AreasRepositoryInterface } from '../../ports/areas.repository.interface';
import {
  AreaNotFoundException,
  BlockOverlapException,
  InvalidBlockRangeException,
} from '../../../domain/exceptions/reservation.exceptions';
import { TimeSlot } from '../../../domain/value-objects/time-slot.vo';
import { ReservationStatus } from '../../../domain/value-objects/reservation-status.vo';

@Injectable()
export class CreateAreaBlockHandler {
  private readonly logger = new Logger(CreateAreaBlockHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepositoryInterface,

    @Inject(AREA_BLOCK_REPOSITORY)
    private readonly areaBlockRepo: AreaBlockRepositoryInterface,

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  async execute(command: CreateAreaBlockCommand): Promise<CreateAreaBlockOutcome> {
    this.logger.log(
      `CreateAreaBlockHandler: areaId=${command.areaId} date=${command.date} ${command.startTime}-${command.endTime}`,
    );

    // ── Step 1: Validate area ───────────────────────────────────────────────
    const area = await this.areasRepo.findById(command.areaId);
    if (!area || area.status !== 'Active') {
      throw new AreaNotFoundException();
    }

    // ── Step 2: Validate block range ────────────────────────────────────────
    try {
      new TimeSlot(command.startTime, command.endTime);
    } catch {
      throw new InvalidBlockRangeException();
    }

    const areaOpenMinutes = TimeSlot.toMinutes(area.openingTime);
    const areaCloseMinutes = TimeSlot.toMinutes(area.closingTime);
    const blockStartMinutes = TimeSlot.toMinutes(command.startTime);
    const blockEndMinutes = TimeSlot.toMinutes(command.endTime);

    if (blockStartMinutes < areaOpenMinutes || blockEndMinutes > areaCloseMinutes) {
      throw new InvalidBlockRangeException();
    }

    // ── Step 3: Check for existing overlapping blocks ───────────────────────
    const existingBlocks = await this.areaBlockRepo.listByAreaAndDate(command.areaId, command.date);

    const overlappingBlock = existingBlocks.find(
      (b) => b.isActive && b.overlapsRange(command.startTime, command.endTime),
    );
    if (overlappingBlock) {
      throw new BlockOverlapException();
    }

    // ── Step 4: Find conflicting CONFIRMED reservations ─────────────────────
    const reservations = await this.reservationRepo.listByAreaAndDate(command.areaId, command.date);

    const blockSlot = new TimeSlot(command.startTime, command.endTime);
    const conflicts = reservations.filter((r) => {
      if (r.status !== ReservationStatus.CONFIRMED) return false;
      try {
        const rSlot = new TimeSlot(r.startTime, r.endTime);
        return blockSlot.overlaps(rSlot);
      } catch {
        return false;
      }
    });

    // ── Step 5: Conflict warning (no force) ─────────────────────────────────
    if (conflicts.length > 0 && !command.confirmForce) {
      return {
        conflict: true,
        affectedReservations: conflicts.map((r) => ({
          reservationId: r.reservationId,
          memberId: r.memberId,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
        message: `Existen ${conflicts.length} reserva(s) activas en este horario. Envíe confirmForce: true para cancelarlas y crear el bloqueo.`,
      };
    }

    // ── Step 6: Create block (with optional force-cancel of conflicts) ───────
    const blockId = ulid();

    if (conflicts.length > 0) {
      // Force cancel all conflicting reservations in a batch TransactWrite
      const conflictKeys: Array<{
        pk: string;
        sk: string;
        memberId: string;
        areaId: string;
        date: string;
        startTime: string;
      }> = [];

      for (const r of conflicts) {
        const keys = await this.reservationRepo.findKeysByReservationId(r.reservationId);
        if (keys) {
          conflictKeys.push({
            pk: keys.pk,
            sk: keys.sk,
            memberId: r.memberId,
            areaId: r.areaId,
            date: r.date,
            startTime: r.startTime,
          });
        }
      }

      if (conflictKeys.length > 0) {
        await this.reservationRepo.batchCancelWithTransaction(conflictKeys, command.reason);
      }
    }

    const block = await this.areaBlockRepo.create({
      blockId,
      areaId: command.areaId,
      date: command.date,
      startTime: command.startTime,
      endTime: command.endTime,
      reason: command.reason,
      createdBy: command.createdBy,
    });

    this.logger.log(
      `CreateAreaBlockHandler: created blockId=${blockId} for areaId=${command.areaId}`,
    );

    return {
      conflict: false,
      block: {
        blockId: block.blockId,
        areaId: block.areaId,
        date: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        reason: block.reason,
        createdAt: block.createdAt,
      },
    };
  }
}
