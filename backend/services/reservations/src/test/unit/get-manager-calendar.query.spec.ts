import { GetManagerCalendarQuery } from '../../application/queries/get-manager-calendar.query';
import { ReservationRepositoryInterface } from '../../domain/repositories/reservation.repository.interface';
import { AreaBlockRepositoryInterface } from '../../domain/repositories/area-block.repository.interface';
import { AreasRepositoryInterface, AreaRecord } from '../../application/ports/areas.repository.interface';
import { AreaBlockEntity } from '../../domain/entities/area-block.entity';
import { ReservationEntity } from '../../domain/entities/reservation.entity';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_AREA: AreaRecord = {
  areaId: 'area-01',
  name: 'Padel Court A',
  status: 'Active',
  capacity: 4,
  slotDuration: 60,
  openingTime: '08:00',
  closingTime: '10:00',
  cancelWindowHours: 2,
  allowedMemberships: ['Silver', 'Gold', 'VIP'],
  maxDurationMinutes: { Silver: 60, Gold: 120, VIP: 240 },
  weeklyLimit: { Silver: 2, Gold: 3, VIP: 5 },
};

function makeReservationEntity(
  overrides: Partial<{ reservationId: string; status: string; startTime: string; endTime: string; memberId: string }> = {},
): ReservationEntity {
  return {
    reservationId: 'res-01',
    memberId: 'member-01',
    areaId: 'area-01',
    date: '2026-05-01',
    startTime: '08:00',
    endTime: '09:00',
    durationMinutes: 60,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    isCancellable: () => true,
    isCancellationWindowOpen: () => true,
    ...overrides,
  } as unknown as ReservationEntity;
}

function makeBlock(overrides: Partial<AreaBlockEntity> = {}): AreaBlockEntity {
  return new AreaBlockEntity({
    blockId: 'block-01',
    areaId: 'area-01',
    date: '2026-05-01',
    startTime: '09:00',
    endTime: '10:00',
    reason: 'Maintenance',
    createdBy: 'manager-01',
    createdAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  });
}

function makeReservationRepo(
  overrides: Partial<ReservationRepositoryInterface> = {},
): jest.Mocked<ReservationRepositoryInterface> {
  return {
    findKeysByReservationId: jest.fn(),
    findByKey: jest.fn(),
    listByMember: jest.fn(),
    listByAreaAndDate: jest.fn().mockResolvedValue([]),
    findExpiredConfirmed: jest.fn(),
    createWithTransaction: jest.fn(),
    cancelWithTransaction: jest.fn(),
    expireWithTransaction: jest.fn(),
    batchCancelWithTransaction: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<ReservationRepositoryInterface>;
}

function makeBlockRepo(
  overrides: Partial<AreaBlockRepositoryInterface> = {},
): jest.Mocked<AreaBlockRepositoryInterface> {
  return {
    listByAreaAndDate: jest.fn().mockResolvedValue([]),
    findKeysByBlockId: jest.fn(),
    create: jest.fn(),
    deactivate: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<AreaBlockRepositoryInterface>;
}

function makeAreasRepo(
  overrides: Partial<AreasRepositoryInterface> = {},
): jest.Mocked<AreasRepositoryInterface> {
  return {
    findById: jest.fn().mockResolvedValue(MOCK_AREA),
    findAllActive: jest.fn().mockResolvedValue([MOCK_AREA]),
    ...overrides,
  } as unknown as jest.Mocked<AreasRepositoryInterface>;
}

function makeQuery(
  reservationRepo?: jest.Mocked<ReservationRepositoryInterface>,
  blockRepo?: jest.Mocked<AreaBlockRepositoryInterface>,
  areasRepo?: jest.Mocked<AreasRepositoryInterface>,
): GetManagerCalendarQuery {
  return new GetManagerCalendarQuery(
    reservationRepo ?? makeReservationRepo(),
    blockRepo ?? makeBlockRepo(),
    areasRepo ?? makeAreasRepo(),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GetManagerCalendarQuery — AC-015', () => {
  describe('Caso 1: fecha válida retorna estructura con áreas y sus reservas/bloques', () => {
    it('returns date and non-empty areas array for a valid date', async () => {
      const reservation = makeReservationEntity();
      const block = makeBlock();

      const query = makeQuery(
        makeReservationRepo({ listByAreaAndDate: jest.fn().mockResolvedValue([reservation]) }),
        makeBlockRepo({ listByAreaAndDate: jest.fn().mockResolvedValue([block]) }),
      );

      const result = await query.execute({ date: '2026-05-01' });

      expect(result.date).toBe('2026-05-01');
      expect(result.areas).toHaveLength(1);

      const area = result.areas[0];
      expect(area.areaId).toBe('area-01');
      expect(area.areaName).toBe('Padel Court A');
      expect(area.capacity).toBe(4);
      expect(area.slots).toBeInstanceOf(Array);
      expect(area.slots.length).toBeGreaterThan(0);
    });

    it('generates correct slot count based on openingTime, closingTime and slotDuration', async () => {
      // area: 08:00-10:00, slotDuration: 60 → 2 slots
      const query = makeQuery();
      const result = await query.execute({ date: '2026-05-01' });

      const area = result.areas[0];
      expect(area.slots).toHaveLength(2);
      expect(area.slots[0].startTime).toBe('08:00');
      expect(area.slots[0].endTime).toBe('09:00');
      expect(area.slots[1].startTime).toBe('09:00');
      expect(area.slots[1].endTime).toBe('10:00');
    });

    it('maps confirmed reservation into the correct slot', async () => {
      const reservation = makeReservationEntity({ startTime: '08:00', endTime: '09:00', status: 'CONFIRMED' });

      const query = makeQuery(
        makeReservationRepo({ listByAreaAndDate: jest.fn().mockResolvedValue([reservation]) }),
      );

      const result = await query.execute({ date: '2026-05-01' });
      const slot = result.areas[0].slots[0]; // 08:00-09:00

      expect(slot.occupancy).toBe(1);
      expect(slot.reservations).toHaveLength(1);
      expect(slot.reservations[0].reservationId).toBe('res-01');
    });

    it('marks slot as blocked when an active block overlaps it', async () => {
      const block = makeBlock({ startTime: '09:00', endTime: '10:00' } as any);

      const query = makeQuery(
        undefined,
        makeBlockRepo({ listByAreaAndDate: jest.fn().mockResolvedValue([block]) }),
      );

      const result = await query.execute({ date: '2026-05-01' });

      const slot08 = result.areas[0].slots[0]; // 08:00-09:00
      const slot09 = result.areas[0].slots[1]; // 09:00-10:00

      expect(slot08.blocked).toBe(false);
      expect(slot09.blocked).toBe(true);
      expect(slot09.blockId).toBe('block-01');
      expect(slot09.blockReason).toBe('Maintenance');
    });

    it('calculates occupancyPercentage correctly', async () => {
      // 1 confirmed in slot 08:00-09:00 (capacity 4), slot 09:00-10:00 empty → total 1/(4*2) = 12.5% → 13%
      const reservation = makeReservationEntity({ startTime: '08:00', endTime: '09:00', status: 'CONFIRMED' });

      const query = makeQuery(
        makeReservationRepo({ listByAreaAndDate: jest.fn().mockResolvedValue([reservation]) }),
      );

      const result = await query.execute({ date: '2026-05-01' });
      expect(result.areas[0].occupancyPercentage).toBe(13);
    });

    it('returns occupancyPercentage = 0 when no reservations exist', async () => {
      const query = makeQuery();
      const result = await query.execute({ date: '2026-05-01' });
      expect(result.areas[0].occupancyPercentage).toBe(0);
    });
  });

  describe('Caso 2: filtro por areaId retorna solo esa área', () => {
    it('calls findById instead of findAllActive when areaId is provided', async () => {
      const areasRepo = makeAreasRepo();
      const query = makeQuery(undefined, undefined, areasRepo);

      await query.execute({ date: '2026-05-01', areaId: 'area-01' });

      expect(areasRepo.findById).toHaveBeenCalledWith('area-01');
      expect(areasRepo.findAllActive).not.toHaveBeenCalled();
    });

    it('returns only the requested area when areaId filter is used', async () => {
      const secondArea: AreaRecord = { ...MOCK_AREA, areaId: 'area-02', name: 'Tennis Court B' };
      const areasRepo = makeAreasRepo({
        findById: jest.fn().mockResolvedValue(MOCK_AREA),
        findAllActive: jest.fn().mockResolvedValue([MOCK_AREA, secondArea]),
      });

      const query = makeQuery(undefined, undefined, areasRepo);
      const result = await query.execute({ date: '2026-05-01', areaId: 'area-01' });

      expect(result.areas).toHaveLength(1);
      expect(result.areas[0].areaId).toBe('area-01');
    });

    it('returns empty areas when the filtered area does not exist', async () => {
      const areasRepo = makeAreasRepo({
        findById: jest.fn().mockResolvedValue(null),
      });

      const query = makeQuery(undefined, undefined, areasRepo);
      const result = await query.execute({ date: '2026-05-01', areaId: 'area-nonexistent' });

      expect(result.areas).toHaveLength(0);
    });

    it('calls listByAreaAndDate with the specific areaId', async () => {
      const reservationRepo = makeReservationRepo();
      const blockRepo = makeBlockRepo();

      const query = makeQuery(reservationRepo, blockRepo);
      await query.execute({ date: '2026-05-01', areaId: 'area-01' });

      expect(reservationRepo.listByAreaAndDate).toHaveBeenCalledWith('area-01', '2026-05-01');
      expect(blockRepo.listByAreaAndDate).toHaveBeenCalledWith('area-01', '2026-05-01');
    });
  });

  describe('Caso 3: fecha con formato inválido', () => {
    it('returns result with the provided date string even when format is invalid (date validation is at controller level)', async () => {
      // The query itself does not validate date format — that is the DTO/controller's
      // responsibility. The query passes the date through to repos and returns it.
      const query = makeQuery();
      const result = await query.execute({ date: 'not-a-date' });
      expect(result.date).toBe('not-a-date');
    });
  });
});
