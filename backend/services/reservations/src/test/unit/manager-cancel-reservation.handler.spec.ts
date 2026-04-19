import { ManagerCancelReservationHandler } from '../../application/commands/manager-cancel-reservation/manager-cancel-reservation.handler';
import { ManagerCancelReservationCommand } from '../../application/commands/manager-cancel-reservation/manager-cancel-reservation.command';
import { ReservationRepositoryInterface } from '../../domain/repositories/reservation.repository.interface';
import {
  ReservationNotFoundException,
  InvalidReservationStatusException,
  ReasonRequiredException,
} from '../../domain/exceptions/reservation.exceptions';
import { ReservationEntity } from '../../domain/entities/reservation.entity';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_KEYS = { pk: 'RESERVATION#res-01', sk: 'MEMBER#member-01' };

function makeReservationEntity(
  status = 'CONFIRMED',
  overrides: Partial<ReservationEntity> = {},
): ReservationEntity {
  return {
    reservationId: 'res-01',
    memberId: 'member-01',
    areaId: 'area-01',
    date: '2026-05-01',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    isCancellable: () => status === 'CONFIRMED',
    isCancellationWindowOpen: () => true,
    ...overrides,
  } as unknown as ReservationEntity;
}

function makeReservationRepo(
  overrides: Partial<ReservationRepositoryInterface> = {},
): jest.Mocked<ReservationRepositoryInterface> {
  return {
    findKeysByReservationId: jest.fn().mockResolvedValue(MOCK_KEYS),
    findByKey: jest.fn().mockResolvedValue(makeReservationEntity()),
    listByMember: jest.fn(),
    listByAreaAndDate: jest.fn(),
    findExpiredConfirmed: jest.fn(),
    createWithTransaction: jest.fn(),
    cancelWithTransaction: jest.fn().mockResolvedValue(undefined),
    expireWithTransaction: jest.fn(),
    batchCancelWithTransaction: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<ReservationRepositoryInterface>;
}

function makeHandler(overrides: Partial<ReservationRepositoryInterface> = {}): ManagerCancelReservationHandler {
  return new ManagerCancelReservationHandler(makeReservationRepo(overrides));
}

const VALID_REASON = 'Court closed for emergency maintenance works';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ManagerCancelReservationHandler — AC-015', () => {
  describe('Caso 1: reserva CONFIRMED se cancela correctamente', () => {
    it('returns the reservationId on successful cancellation', async () => {
      const handler = makeHandler();
      const result = await handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON));
      expect(result.reservationId).toBe('res-01');
    });

    it('calls cancelWithTransaction with cancelledByRole = MANAGER and byManager = true', async () => {
      const repo = makeReservationRepo();
      const handler = new ManagerCancelReservationHandler(repo);

      await handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON));

      expect(repo.cancelWithTransaction).toHaveBeenCalledTimes(1);
      const payload = repo.cancelWithTransaction.mock.calls[0][0];
      expect(payload.cancelledByRole).toBe('MANAGER');
      expect(payload.byManager).toBe(true);
    });

    it('passes the trimmed reason to cancelWithTransaction', async () => {
      const repo = makeReservationRepo();
      const handler = new ManagerCancelReservationHandler(repo);
      const paddedReason = '  Court closed for emergency maintenance works  ';

      await handler.execute(new ManagerCancelReservationCommand('res-01', paddedReason));

      const payload = repo.cancelWithTransaction.mock.calls[0][0];
      expect(payload.cancelReason).toBe(VALID_REASON);
    });

    it('passes correct pk and sk resolved from GSI lookup', async () => {
      const repo = makeReservationRepo();
      const handler = new ManagerCancelReservationHandler(repo);

      await handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON));

      const payload = repo.cancelWithTransaction.mock.calls[0][0];
      expect(payload.pk).toBe(MOCK_KEYS.pk);
      expect(payload.sk).toBe(MOCK_KEYS.sk);
    });

    it('does not check cancellation time window (manager bypass)', async () => {
      // Manager cancel should succeed even if reservation starts in < 2h
      const handler = makeHandler();
      // No CancellationWindowClosedException should be thrown
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON)),
      ).resolves.toEqual({ reservationId: 'res-01' });
    });
  });

  describe('Caso 2: reserva no existe → lanza RESERVATION_NOT_FOUND', () => {
    it('throws ReservationNotFoundException when GSI lookup returns null', async () => {
      const handler = makeHandler({ findKeysByReservationId: jest.fn().mockResolvedValue(null) });
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-nonexistent', VALID_REASON)),
      ).rejects.toThrow(ReservationNotFoundException);
    });

    it('throws ReservationNotFoundException when item is missing after key lookup', async () => {
      const handler = makeHandler({ findByKey: jest.fn().mockResolvedValue(null) });
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON)),
      ).rejects.toThrow(ReservationNotFoundException);
    });

    it('does not call cancelWithTransaction when reservation is not found', async () => {
      const repo = makeReservationRepo({ findKeysByReservationId: jest.fn().mockResolvedValue(null) });
      const handler = new ManagerCancelReservationHandler(repo);

      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON)),
      ).rejects.toThrow(ReservationNotFoundException);

      expect(repo.cancelWithTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Caso 3: reserva ya CANCELLED → lanza INVALID_STATUS', () => {
    it('throws InvalidReservationStatusException for CANCELLED reservation', async () => {
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity('CANCELLED')),
      });
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON)),
      ).rejects.toThrow(InvalidReservationStatusException);
    });

    it('throws InvalidReservationStatusException for EXPIRED reservation', async () => {
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity('EXPIRED')),
      });
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON)),
      ).rejects.toThrow(InvalidReservationStatusException);
    });

    it('does not call cancelWithTransaction when status is invalid', async () => {
      const repo = makeReservationRepo({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity('CANCELLED')),
      });
      const handler = new ManagerCancelReservationHandler(repo);

      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', VALID_REASON)),
      ).rejects.toThrow(InvalidReservationStatusException);

      expect(repo.cancelWithTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Caso 4: reason vacío o muy corto → lanza REASON_REQUIRED', () => {
    it('throws ReasonRequiredException when reason is empty string', async () => {
      const handler = makeHandler();
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', '')),
      ).rejects.toThrow(ReasonRequiredException);
    });

    it('throws ReasonRequiredException when reason is only whitespace', async () => {
      const handler = makeHandler();
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', '   ')),
      ).rejects.toThrow(ReasonRequiredException);
    });

    it('throws ReasonRequiredException when reason is fewer than 10 characters', async () => {
      const handler = makeHandler();
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', 'Short')),
      ).rejects.toThrow(ReasonRequiredException);
    });

    it('does not call any repo method when reason validation fails', async () => {
      const repo = makeReservationRepo();
      const handler = new ManagerCancelReservationHandler(repo);

      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', '')),
      ).rejects.toThrow(ReasonRequiredException);

      expect(repo.findKeysByReservationId).not.toHaveBeenCalled();
      expect(repo.cancelWithTransaction).not.toHaveBeenCalled();
    });

    it('accepts reason with exactly 10 characters', async () => {
      const handler = makeHandler();
      // '1234567890' is exactly 10 chars
      await expect(
        handler.execute(new ManagerCancelReservationCommand('res-01', '1234567890')),
      ).resolves.toEqual({ reservationId: 'res-01' });
    });
  });
});
