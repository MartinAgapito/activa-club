import { Injectable, Inject, Logger } from '@nestjs/common';
import { CancelReservationCommand } from './cancel-reservation.command';
import {
  RESERVATION_REPOSITORY,
  ReservationRepositoryInterface,
} from '../../../domain/repositories/reservation.repository.interface';
import { AREAS_REPOSITORY, AreasRepositoryInterface } from '../../ports/areas.repository.interface';
import {
  ReservationNotFoundException,
  ForbiddenReservationException,
  InvalidReservationStatusException,
  CancellationWindowClosedException,
} from '../../../domain/exceptions/reservation.exceptions';

@Injectable()
export class CancelReservationHandler {
  private readonly logger = new Logger(CancelReservationHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepositoryInterface,

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  async execute(command: CancelReservationCommand): Promise<{ reservationId: string }> {
    this.logger.log(
      `CancelReservationHandler: memberId=${command.memberId} reservationId=${command.reservationId}`,
    );

    // ── Step 1: Resolve pk+sk via GSI_ReservationId ─────────────────────────
    const keys = await this.reservationRepo.findKeysByReservationId(command.reservationId);
    if (!keys) {
      throw new ReservationNotFoundException();
    }

    // ── Step 2: Load full reservation ───────────────────────────────────────
    const reservation = await this.reservationRepo.findByKey(keys.pk, keys.sk);
    if (!reservation) {
      throw new ReservationNotFoundException();
    }

    // ── Step 3: Ownership check ─────────────────────────────────────────────
    if (reservation.memberId !== command.memberId) {
      throw new ForbiddenReservationException();
    }

    // ── Step 4: Status check ────────────────────────────────────────────────
    if (!reservation.isCancellable()) {
      throw new InvalidReservationStatusException();
    }

    // ── Step 5: Cancellation window check ───────────────────────────────────
    const area = await this.areasRepo.findById(reservation.areaId);
    const cancelWindowHours = area?.cancelWindowHours ?? 2;
    const now = new Date();

    if (!reservation.isCancellationWindowOpen(now, cancelWindowHours)) {
      throw new CancellationWindowClosedException();
    }

    // ── Step 6: TransactWrite (cancel + decrement occupancy + decrement quota) ─
    await this.reservationRepo.cancelWithTransaction({
      pk: keys.pk,
      sk: keys.sk,
      memberId: reservation.memberId,
      areaId: reservation.areaId,
      date: reservation.date,
      startTime: reservation.startTime,
      cancelledByRole: 'MEMBER',
      byManager: false,
    });

    this.logger.log(`CancelReservationHandler: cancelled reservationId=${command.reservationId}`);

    return { reservationId: command.reservationId };
  }
}
