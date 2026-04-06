import { Injectable, Inject, Logger } from '@nestjs/common';
import { ManagerCancelReservationCommand } from './manager-cancel-reservation.command';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../../domain/repositories/reservation.repository.interface';
import {
  ReservationNotFoundException,
  InvalidReservationStatusException,
  ReasonRequiredException,
} from '../../../domain/exceptions/reservation.exceptions';

@Injectable()
export class ManagerCancelReservationHandler {
  private readonly logger = new Logger(ManagerCancelReservationHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepositoryInterface,
  ) {}

  async execute(command: ManagerCancelReservationCommand): Promise<{ reservationId: string }> {
    this.logger.log(`ManagerCancelReservationHandler: reservationId=${command.reservationId}`);

    // ── Validate reason ─────────────────────────────────────────────────────
    if (!command.reason || command.reason.trim().length < 10) {
      throw new ReasonRequiredException();
    }

    // ── Resolve pk+sk ────────────────────────────────────────────────────────
    const keys = await this.reservationRepo.findKeysByReservationId(command.reservationId);
    if (!keys) {
      throw new ReservationNotFoundException();
    }

    const reservation = await this.reservationRepo.findByKey(keys.pk, keys.sk);
    if (!reservation) {
      throw new ReservationNotFoundException();
    }

    // ── Status check ─────────────────────────────────────────────────────────
    if (!reservation.isCancellable()) {
      throw new InvalidReservationStatusException();
    }

    // ── TransactWrite — manager cancel (no window check) ─────────────────────
    await this.reservationRepo.cancelWithTransaction({
      pk: keys.pk,
      sk: keys.sk,
      memberId: reservation.memberId,
      areaId: reservation.areaId,
      date: reservation.date,
      startTime: reservation.startTime,
      cancelReason: command.reason.trim(),
      cancelledByRole: 'MANAGER',
      byManager: true,
    });

    this.logger.log(
      `ManagerCancelReservationHandler: cancelled reservationId=${command.reservationId} by manager`,
    );

    return { reservationId: command.reservationId };
  }
}
