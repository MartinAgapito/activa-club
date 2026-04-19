import { CreateReservationHandler } from '../../application/commands/create-reservation/create-reservation.handler';
import { CreateReservationCommand } from '../../application/commands/create-reservation/create-reservation.command';
import { ReservationRepositoryInterface } from '../../domain/repositories/reservation.repository.interface';
import { AreasRepositoryInterface } from '../../application/ports/areas.repository.interface';
import { MembersRepositoryInterface } from '../../application/ports/members.repository.interface';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../domain/value-objects/reservation-status.vo';
import {
  SlotFullException,
  WeeklyQuotaExceededException,
  AreaNotFoundException,
  AreaNotAccessibleException,
  DateInPastException,
  MembershipInactiveException,
  DurationExceedsMaximumException,
  OverlapConflictException,
} from '../../domain/exceptions/reservation.exceptions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TOMORROW = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const mockArea = {
  areaId: 'area-01',
  name: 'Piscina Principal',
  status: 'Active',
  capacity: 10,
  allowedMemberships: ['Silver', 'Gold', 'VIP'],
  openingTime: '08:00',
  closingTime: '20:00',
  slotDuration: 60,
  maxDurationMinutes: { Silver: 60, Gold: 120, VIP: 120 },
  weeklyLimit: { Silver: 2, Gold: 4, VIP: 8 },
  cancelWindowHours: 2,
};

const mockMember = {
  memberId: 'member-01',
  accountStatus: 'active',
  weeklyReservationCount: 0,
  weeklyResetAt: new Date(Date.now() + 7 * 86400000).toISOString(),
};

function makeReservationRepo(
  overrides: Partial<ReservationRepositoryInterface> = {},
): jest.Mocked<ReservationRepositoryInterface> {
  return {
    findById: jest.fn(),
    listByMember: jest.fn().mockResolvedValue({ items: [], lastKey: undefined }),
    listByArea: jest.fn().mockResolvedValue({ items: [], lastKey: undefined }),
    createWithTransaction: jest.fn().mockResolvedValue({
      reservationId: 'res-01',
      areaId: 'area-01',
      areaName: 'Piscina Principal',
      date: TOMORROW,
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    }),
    cancelWithTransaction: jest.fn(),
    updateStatus: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<ReservationRepositoryInterface>;
}

function makeAreasRepo(overrides = {}): jest.Mocked<AreasRepositoryInterface> {
  return {
    findById: jest.fn().mockResolvedValue(mockArea),
    ...overrides,
  } as unknown as jest.Mocked<AreasRepositoryInterface>;
}

function makeMembersRepo(overrides = {}): jest.Mocked<MembersRepositoryInterface> {
  return {
    findById: jest.fn().mockResolvedValue(mockMember),
    findByCognitoSub: jest.fn().mockResolvedValue(mockMember),
    updateWeeklyCount: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<MembersRepositoryInterface>;
}

function makeHandler(
  reservationRepo?: Partial<ReservationRepositoryInterface>,
  areasRepo?: Partial<AreasRepositoryInterface>,
  membersRepo?: Partial<MembersRepositoryInterface>,
) {
  return new CreateReservationHandler(
    makeReservationRepo(reservationRepo),
    makeAreasRepo(areasRepo),
    makeMembersRepo(membersRepo),
  );
}

function makeCommand(overrides: Partial<CreateReservationCommand> = {}): CreateReservationCommand {
  return new CreateReservationCommand(
    overrides.memberId ?? 'member-01',
    overrides.cognitoSub ?? 'cognito-sub-01',
    overrides.membershipType ?? 'Silver',
    overrides.areaId ?? 'area-01',
    overrides.date ?? TOMORROW,
    overrides.startTime ?? '10:00',
    overrides.durationMinutes ?? 60,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateReservationHandler', () => {
  describe('Happy path — AC-012', () => {
    it('creates reservation and returns result on valid input', async () => {
      const handler = makeHandler();
      const result = await handler.execute(makeCommand());

      expect(result.reservationId).toBe('res-01');
      expect(result.status).toBe('CONFIRMED');
      expect(result.startTime).toBe('10:00');
      expect(result.endTime).toBe('11:00');
    });

    it('calls createWithTransaction on the repository', async () => {
      const reservationRepo = makeReservationRepo();
      const handler = new CreateReservationHandler(
        reservationRepo,
        makeAreasRepo(),
        makeMembersRepo(),
      );

      await handler.execute(makeCommand());

      expect(reservationRepo.createWithTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('SLOT_FULL — concurrent booking (AC-012)', () => {
    it('throws SlotFullException when slot is taken concurrently', async () => {
      // The repository converts TransactionCanceledException → SlotFullException internally.
      // The handler receives SlotFullException and lets it propagate.
      const handler = makeHandler({
        createWithTransaction: jest.fn().mockRejectedValue(new SlotFullException()),
      });

      await expect(handler.execute(makeCommand())).rejects.toThrow(SlotFullException);
    });
  });

  describe('Weekly quota — AC-012', () => {
    it('throws WeeklyQuotaExceededException when member has reached Silver limit (2)', async () => {
      const handler = makeHandler(
        {},
        {},
        { findById: jest.fn().mockResolvedValue({ ...mockMember, weeklyReservationCount: 2 }) },
      );

      await expect(handler.execute(makeCommand())).rejects.toThrow(WeeklyQuotaExceededException);
    });

    it('resets weekly count and allows booking when weeklyResetAt has passed', async () => {
      const expiredMember = {
        ...mockMember,
        weeklyReservationCount: 2, // would exceed if not reset
        weeklyResetAt: new Date(Date.now() - 1000).toISOString(), // past
      };
      const handler = makeHandler({}, {}, { findById: jest.fn().mockResolvedValue(expiredMember) });

      // Should NOT throw — count resets to 0 before checking quota
      const result = await handler.execute(makeCommand());
      expect(result.reservationId).toBe('res-01');
    });
  });

  describe('Area validation — AC-012', () => {
    it('throws AreaNotFoundException when area does not exist', async () => {
      const handler = makeHandler({}, { findById: jest.fn().mockResolvedValue(null) });
      await expect(handler.execute(makeCommand())).rejects.toThrow(AreaNotFoundException);
    });

    it('throws AreaNotAccessibleException when membership not in allowed list', async () => {
      const restrictedArea = { ...mockArea, allowedMemberships: ['Gold', 'VIP'] };
      const handler = makeHandler({}, { findById: jest.fn().mockResolvedValue(restrictedArea) });
      // Silver member trying to book Gold-only area
      await expect(handler.execute(makeCommand())).rejects.toThrow(AreaNotAccessibleException);
    });
  });

  describe('Date validation — AC-012', () => {
    it('throws DateInPastException when date is today or earlier', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const pastDate = yesterday.toISOString().slice(0, 10);

      const handler = makeHandler();
      await expect(handler.execute(makeCommand({ date: pastDate }))).rejects.toThrow(
        DateInPastException,
      );
    });
  });

  describe('Membership inactive — AC-012', () => {
    it('throws MembershipInactiveException when member accountStatus is suspended', async () => {
      const suspendedMember = { ...mockMember, accountStatus: 'suspended' };
      const handler = makeHandler(
        {},
        {},
        { findById: jest.fn().mockResolvedValue(suspendedMember) },
      );

      await expect(handler.execute(makeCommand())).rejects.toThrow(MembershipInactiveException);
    });

    it('throws MembershipInactiveException when member record does not exist', async () => {
      const handler = makeHandler({}, {}, { findById: jest.fn().mockResolvedValue(null) });

      await expect(handler.execute(makeCommand())).rejects.toThrow(MembershipInactiveException);
    });
  });

  describe('Duration validation — AC-012', () => {
    it('throws DurationExceedsMaximumException when Silver member requests 120 min', async () => {
      // Silver max is 60 min in mockArea
      const handler = makeHandler();

      await expect(
        handler.execute(makeCommand({ membershipType: 'Silver', durationMinutes: 120 })),
      ).rejects.toThrow(DurationExceedsMaximumException);
    });

    it('allows Gold member to book 120 min (within their limit)', async () => {
      const goldArea = {
        ...mockArea,
        allowedMemberships: ['Silver', 'Gold', 'VIP'],
        maxDurationMinutes: { Silver: 60, Gold: 120, VIP: 120 },
      };
      const goldMember = { ...mockMember };
      const reservationRepo = makeReservationRepo();
      const handler = new CreateReservationHandler(
        reservationRepo,
        makeAreasRepo({ findById: jest.fn().mockResolvedValue(goldArea) }),
        makeMembersRepo({ findById: jest.fn().mockResolvedValue(goldMember) }),
      );

      const result = await handler.execute(
        makeCommand({ membershipType: 'Gold', durationMinutes: 120 }),
      );

      expect(result.reservationId).toBe('res-01');
      expect(reservationRepo.createWithTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Overlap conflict — AC-012', () => {
    it('throws OverlapConflictException when member has a CONFIRMED reservation on same date/slot', async () => {
      // Build an existing confirmed reservation that overlaps 10:00–11:00
      const existingReservation = new ReservationEntity({
        reservationId: 'existing-res',
        memberId: 'member-01',
        areaId: 'area-01',
        areaName: 'Piscina Principal',
        date: TOMORROW,
        startTime: '10:00',
        endTime: '11:00',
        durationMinutes: 60,
        status: ReservationStatus.CONFIRMED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      const handler = makeHandler({
        listByMember: jest
          .fn()
          .mockResolvedValue({ items: [existingReservation], lastKey: null }),
      });

      // Requesting the exact same slot triggers overlap
      await expect(handler.execute(makeCommand({ startTime: '10:00' }))).rejects.toThrow(
        OverlapConflictException,
      );
    });

    it('does NOT throw OverlapConflictException for a CANCELLED reservation in the same slot', async () => {
      const cancelledReservation = new ReservationEntity({
        reservationId: 'cancelled-res',
        memberId: 'member-01',
        areaId: 'area-01',
        areaName: 'Piscina Principal',
        date: TOMORROW,
        startTime: '10:00',
        endTime: '11:00',
        durationMinutes: 60,
        status: ReservationStatus.CANCELLED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      const reservationRepo = makeReservationRepo({
        listByMember: jest
          .fn()
          .mockResolvedValue({ items: [cancelledReservation], lastKey: null }),
      });
      const handler = new CreateReservationHandler(
        reservationRepo,
        makeAreasRepo(),
        makeMembersRepo(),
      );

      // Cancelled reservation should not block a new booking in the same slot
      const result = await handler.execute(makeCommand({ startTime: '10:00' }));
      expect(result.reservationId).toBe('res-01');
    });
  });
});
