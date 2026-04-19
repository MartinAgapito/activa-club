import { CancelReservationHandler } from '../../application/commands/cancel-reservation/cancel-reservation.handler';
import { CancelReservationCommand } from '../../application/commands/cancel-reservation/cancel-reservation.command';
import { ReservationRepositoryInterface } from '../../domain/repositories/reservation.repository.interface';
import { AreasRepositoryInterface } from '../../application/ports/areas.repository.interface';
import {
  ReservationNotFoundException,
  ForbiddenReservationException,
  CancellationWindowClosedException,
  InvalidReservationStatusException,
} from '../../domain/exceptions/reservation.exceptions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_KEYS = { pk: 'RESERVATION#res-01', sk: 'MEMBER#member-01' };

function futureDate(hoursFromNow: number): { date: string; startTime: string } {
  const future = new Date(Date.now() + hoursFromNow * 3600000);
  const date = future.toISOString().slice(0, 10);
  const h = String(future.getUTCHours()).padStart(2, '0');
  const m = String(future.getUTCMinutes()).padStart(2, '0');
  return { date, startTime: `${h}:${m}` };
}

function makeReservationEntity(hoursUntilStart: number, memberId = 'member-01', status = 'CONFIRMED') {
  const { date, startTime } = futureDate(hoursUntilStart);
  return {
    reservationId: 'res-01',
    memberId,
    areaId: 'area-01',
    date,
    startTime,
    endTime: '12:00',
    durationMinutes: 60,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    isCancellable: () => status === 'CONFIRMED',
    isCancellationWindowOpen: (now: Date, windowHours: number) => {
      const slotStart = new Date(`${date}T${startTime}:00Z`);
      const diffHours = (slotStart.getTime() - now.getTime()) / 3600000;
      return diffHours >= windowHours;
    },
  };
}

function makeReservationRepo(
  overrides: Partial<ReservationRepositoryInterface> = {},
): jest.Mocked<ReservationRepositoryInterface> {
  return {
    findKeysByReservationId: jest.fn().mockResolvedValue(MOCK_KEYS),
    findByKey: jest.fn().mockResolvedValue(makeReservationEntity(3)),
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

function makeAreasRepo(cancelWindowHours = 2): jest.Mocked<AreasRepositoryInterface> {
  return {
    findById: jest.fn().mockResolvedValue({ areaId: 'area-01', cancelWindowHours }),
  } as unknown as jest.Mocked<AreasRepositoryInterface>;
}

function makeHandler(
  repoOverrides: Partial<ReservationRepositoryInterface> = {},
  cancelWindowHours = 2,
) {
  return new CancelReservationHandler(
    makeReservationRepo(repoOverrides),
    makeAreasRepo(cancelWindowHours),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CancelReservationHandler — AC-013', () => {
  describe('Happy path', () => {
    it('cancels a CONFIRMED reservation more than 2 hours before start', async () => {
      const handler = makeHandler();
      const result = await handler.execute(new CancelReservationCommand('member-01', 'res-01'));
      expect(result.reservationId).toBe('res-01');
    });

    it('calls cancelWithTransaction on the repository', async () => {
      const repo = makeReservationRepo();
      const handler = new CancelReservationHandler(repo, makeAreasRepo());
      await handler.execute(new CancelReservationCommand('member-01', 'res-01'));
      expect(repo.cancelWithTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancellation window — AC-013', () => {
    it('throws CancellationWindowClosedException when < 2 hours before start', async () => {
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity(1)), // 1h — inside window
      });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-01')),
      ).rejects.toThrow(CancellationWindowClosedException);
    });

    it('throws CancellationWindowClosedException just under the 2h boundary', async () => {
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity(1.9)),
      });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-01')),
      ).rejects.toThrow(CancellationWindowClosedException);
    });
  });

  describe('Authorization — AC-013', () => {
    it('throws ForbiddenReservationException when member tries to cancel another member reservation', async () => {
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity(3, 'member-OTHER')),
      });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-01')),
      ).rejects.toThrow(ForbiddenReservationException);
    });
  });

  describe('Status validation — AC-013', () => {
    it('throws InvalidReservationStatusException when reservation is already CANCELLED', async () => {
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity(3, 'member-01', 'CANCELLED')),
      });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-01')),
      ).rejects.toThrow(InvalidReservationStatusException);
    });

    it('throws InvalidReservationStatusException when reservation is EXPIRED', async () => {
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity(3, 'member-01', 'EXPIRED')),
      });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-01')),
      ).rejects.toThrow(InvalidReservationStatusException);
    });

    it('throws InvalidReservationStatusException when reservation status is ACTIVE (already started)', async () => {
      // AC-013: reservations that have already begun cannot be cancelled.
      // In the domain model, 'ACTIVE' is treated as a non-cancellable status
      // because isCancellable() returns false for any status other than CONFIRMED.
      const handler = makeHandler({
        findByKey: jest.fn().mockResolvedValue(makeReservationEntity(3, 'member-01', 'ACTIVE')),
      });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-01')),
      ).rejects.toThrow(InvalidReservationStatusException);
    });
  });

  describe('Not found — AC-013', () => {
    it('throws ReservationNotFoundException when reservationId is not in GSI', async () => {
      const handler = makeHandler({ findKeysByReservationId: jest.fn().mockResolvedValue(null) });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-nonexistent')),
      ).rejects.toThrow(ReservationNotFoundException);
    });

    it('throws ReservationNotFoundException when item is missing after key lookup', async () => {
      const handler = makeHandler({ findByKey: jest.fn().mockResolvedValue(null) });
      await expect(
        handler.execute(new CancelReservationCommand('member-01', 'res-01')),
      ).rejects.toThrow(ReservationNotFoundException);
    });
  });
});
