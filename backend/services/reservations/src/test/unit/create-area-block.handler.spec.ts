import { CreateAreaBlockHandler } from '../../application/commands/create-area-block/create-area-block.handler';
import { CreateAreaBlockCommand } from '../../application/commands/create-area-block/create-area-block.command';
import { ReservationRepositoryInterface } from '../../domain/repositories/reservation.repository.interface';
import { AreaBlockRepositoryInterface } from '../../domain/repositories/area-block.repository.interface';
import { AreasRepositoryInterface, AreaRecord } from '../../application/ports/areas.repository.interface';
import { AreaBlockEntity } from '../../domain/entities/area-block.entity';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import {
  AreaNotFoundException,
} from '../../domain/exceptions/reservation.exceptions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_AREA: AreaRecord = {
  areaId: 'area-01',
  name: 'Padel Court A',
  status: 'Active',
  capacity: 4,
  slotDuration: 60,
  openingTime: '08:00',
  closingTime: '18:00',
  cancelWindowHours: 2,
  allowedMemberships: ['Silver', 'Gold', 'VIP'],
  maxDurationMinutes: { Silver: 60, Gold: 120, VIP: 240 },
  weeklyLimit: { Silver: 2, Gold: 3, VIP: 5 },
};

const MOCK_BLOCK_KEYS = { pk: 'AREA#area-01#DATE#2026-05-01', sk: 'BLOCK#block-01' };

function makeBlockEntity(overrides: Partial<AreaBlockEntity> = {}): AreaBlockEntity {
  return new AreaBlockEntity({
    blockId: 'block-01',
    areaId: 'area-01',
    date: '2026-05-01',
    startTime: '10:00',
    endTime: '12:00',
    reason: 'Maintenance window',
    createdBy: 'manager-01',
    createdAt: new Date().toISOString(),
    isActive: true,
    ...overrides,
  });
}

function makeReservationEntity(
  overrides: Partial<{
    reservationId: string;
    memberId: string;
    areaId: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  }> = {},
): ReservationEntity {
  return {
    reservationId: 'res-01',
    memberId: 'member-01',
    areaId: 'area-01',
    date: '2026-05-01',
    startTime: '10:00',
    endTime: '11:00',
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

function makeReservationRepo(
  overrides: Partial<ReservationRepositoryInterface> = {},
): jest.Mocked<ReservationRepositoryInterface> {
  return {
    findKeysByReservationId: jest.fn().mockResolvedValue({ pk: 'RESERVATION#res-01', sk: 'MEMBER#member-01' }),
    findByKey: jest.fn(),
    listByMember: jest.fn(),
    listByAreaAndDate: jest.fn().mockResolvedValue([]),
    findExpiredConfirmed: jest.fn(),
    createWithTransaction: jest.fn(),
    cancelWithTransaction: jest.fn(),
    expireWithTransaction: jest.fn(),
    batchCancelWithTransaction: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<ReservationRepositoryInterface>;
}

function makeBlockRepo(
  overrides: Partial<AreaBlockRepositoryInterface> = {},
): jest.Mocked<AreaBlockRepositoryInterface> {
  return {
    listByAreaAndDate: jest.fn().mockResolvedValue([]),
    findKeysByBlockId: jest.fn().mockResolvedValue(MOCK_BLOCK_KEYS),
    create: jest.fn().mockResolvedValue(makeBlockEntity()),
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

function makeHandler(
  reservationRepo?: jest.Mocked<ReservationRepositoryInterface>,
  blockRepo?: jest.Mocked<AreaBlockRepositoryInterface>,
  areasRepo?: jest.Mocked<AreasRepositoryInterface>,
): CreateAreaBlockHandler {
  return new CreateAreaBlockHandler(
    reservationRepo ?? makeReservationRepo(),
    blockRepo ?? makeBlockRepo(),
    areasRepo ?? makeAreasRepo(),
  );
}

// Block in 10:00-12:00, area 08:00-18:00
const VALID_COMMAND = new CreateAreaBlockCommand(
  'manager-01',
  'area-01',
  '2026-05-01',
  '10:00',
  '12:00',
  'Court closed for maintenance works today',
  false,
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateAreaBlockHandler — AC-015', () => {
  describe('Caso 1: franja sin reservas activas → bloque creado exitosamente', () => {
    it('returns conflict=false and block data when no conflicts exist', async () => {
      const handler = makeHandler();
      const result = await handler.execute(VALID_COMMAND);

      expect(result.conflict).toBe(false);
      const successResult = result as Extract<typeof result, { conflict: false }>;
      expect(successResult.block.blockId).toBeDefined();
      expect(successResult.block.areaId).toBe('area-01');
      expect(successResult.block.startTime).toBe('10:00');
      expect(successResult.block.endTime).toBe('12:00');
    });

    it('calls areaBlockRepo.create once with correct payload', async () => {
      const blockRepo = makeBlockRepo();
      const handler = makeHandler(undefined, blockRepo);

      await handler.execute(VALID_COMMAND);

      expect(blockRepo.create).toHaveBeenCalledTimes(1);
      const payload = blockRepo.create.mock.calls[0][0];
      expect(payload.areaId).toBe('area-01');
      expect(payload.startTime).toBe('10:00');
      expect(payload.endTime).toBe('12:00');
      expect(payload.reason).toBe(VALID_COMMAND.reason);
    });

    it('does not call batchCancelWithTransaction when there are no conflicts', async () => {
      const reservationRepo = makeReservationRepo();
      const handler = makeHandler(reservationRepo);

      await handler.execute(VALID_COMMAND);

      expect(reservationRepo.batchCancelWithTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Caso 2: franja con reservas activas, confirmForce=false → 409 con lista de conflictos', () => {
    it('returns conflict=true with affectedReservations list when confirmForce is false', async () => {
      const conflictingReservation = makeReservationEntity({
        reservationId: 'res-conflict-01',
        startTime: '10:30',
        endTime: '11:30',
        status: 'CONFIRMED',
      });

      const reservationRepo = makeReservationRepo({
        listByAreaAndDate: jest.fn().mockResolvedValue([conflictingReservation]),
      });

      const handler = makeHandler(reservationRepo);
      const result = await handler.execute(VALID_COMMAND); // confirmForce defaults to false

      expect(result.conflict).toBe(true);
      const conflictResult = result as Extract<typeof result, { conflict: true }>;
      expect(conflictResult.affectedReservations).toHaveLength(1);
      expect(conflictResult.affectedReservations[0].reservationId).toBe('res-conflict-01');
      expect(conflictResult.affectedReservations[0].memberId).toBe('member-01');
      expect(conflictResult.message).toContain('confirmForce');
    });

    it('does not create the block when returning conflict warning', async () => {
      const conflictingReservation = makeReservationEntity({ status: 'CONFIRMED' });
      const blockRepo = makeBlockRepo();

      const handler = makeHandler(
        makeReservationRepo({ listByAreaAndDate: jest.fn().mockResolvedValue([conflictingReservation]) }),
        blockRepo,
      );

      await handler.execute(VALID_COMMAND);

      expect(blockRepo.create).not.toHaveBeenCalled();
    });

    it('does not count CANCELLED reservations as conflicts', async () => {
      const cancelledReservation = makeReservationEntity({ status: 'CANCELLED', reservationId: 'res-cancelled' });

      const reservationRepo = makeReservationRepo({
        listByAreaAndDate: jest.fn().mockResolvedValue([cancelledReservation]),
      });

      const handler = makeHandler(reservationRepo);
      const result = await handler.execute(VALID_COMMAND);

      // No conflict — CANCELLED is not CONFIRMED
      expect(result.conflict).toBe(false);
    });

    it('includes all overlapping confirmed reservations in affectedReservations', async () => {
      const res1 = makeReservationEntity({ reservationId: 'res-01', startTime: '10:00', endTime: '11:00', status: 'CONFIRMED' });
      const res2 = makeReservationEntity({ reservationId: 'res-02', memberId: 'member-02', startTime: '11:00', endTime: '12:00', status: 'CONFIRMED' });

      const reservationRepo = makeReservationRepo({
        listByAreaAndDate: jest.fn().mockResolvedValue([res1, res2]),
      });

      const handler = makeHandler(reservationRepo);
      const result = await handler.execute(VALID_COMMAND);

      expect(result.conflict).toBe(true);
      const conflictResult2 = result as Extract<typeof result, { conflict: true }>;
      expect(conflictResult2.affectedReservations).toHaveLength(2);
    });
  });

  describe('Caso 3: franja con reservas activas, confirmForce=true → cancela reservas y crea bloque', () => {
    it('calls batchCancelWithTransaction and then creates the block when confirmForce=true', async () => {
      const conflictingReservation = makeReservationEntity({ status: 'CONFIRMED' });
      const reservationRepo = makeReservationRepo({
        listByAreaAndDate: jest.fn().mockResolvedValue([conflictingReservation]),
      });
      const blockRepo = makeBlockRepo();

      const forceCommand = new CreateAreaBlockCommand(
        'manager-01',
        'area-01',
        '2026-05-01',
        '10:00',
        '12:00',
        'Court closed for maintenance works today',
        true, // confirmForce
      );

      const handler = makeHandler(reservationRepo, blockRepo);
      const result = await handler.execute(forceCommand);

      expect(reservationRepo.batchCancelWithTransaction).toHaveBeenCalledTimes(1);
      expect(blockRepo.create).toHaveBeenCalledTimes(1);
      expect(result.conflict).toBe(false);
    });

    it('passes the block reason to batchCancelWithTransaction', async () => {
      const conflictingReservation = makeReservationEntity({ status: 'CONFIRMED' });
      const reservationRepo = makeReservationRepo({
        listByAreaAndDate: jest.fn().mockResolvedValue([conflictingReservation]),
      });

      const forceCommand = new CreateAreaBlockCommand(
        'manager-01',
        'area-01',
        '2026-05-01',
        '10:00',
        '12:00',
        'Court closed for maintenance works today',
        true,
      );

      const handler = makeHandler(reservationRepo);
      await handler.execute(forceCommand);

      const [, reason] = reservationRepo.batchCancelWithTransaction.mock.calls[0];
      expect(reason).toBe('Court closed for maintenance works today');
    });

    it('returns conflict=false with block data on successful force creation', async () => {
      const conflictingReservation = makeReservationEntity({ status: 'CONFIRMED' });
      const reservationRepo = makeReservationRepo({
        listByAreaAndDate: jest.fn().mockResolvedValue([conflictingReservation]),
      });

      const forceCommand = new CreateAreaBlockCommand(
        'manager-01', 'area-01', '2026-05-01', '10:00', '12:00',
        'Court closed for maintenance works today', true,
      );

      const handler = makeHandler(reservationRepo);
      const result = await handler.execute(forceCommand);

      expect(result.conflict).toBe(false);
      const successResult2 = result as Extract<typeof result, { conflict: false }>;
      expect(successResult2.block).toBeDefined();
      expect(successResult2.block.areaId).toBe('area-01');
    });
  });

  describe('Caso 4: área no existe → lanza AREA_NOT_FOUND', () => {
    it('throws AreaNotFoundException when area is not found', async () => {
      const areasRepo = makeAreasRepo({ findById: jest.fn().mockResolvedValue(null) });
      const handler = makeHandler(undefined, undefined, areasRepo);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(AreaNotFoundException);
    });

    it('throws AreaNotFoundException when area status is Inactive', async () => {
      const inactiveArea: AreaRecord = { ...MOCK_AREA, status: 'Inactive' };
      const areasRepo = makeAreasRepo({ findById: jest.fn().mockResolvedValue(inactiveArea) });
      const handler = makeHandler(undefined, undefined, areasRepo);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(AreaNotFoundException);
    });

    it('does not call any repo method beyond areasRepo.findById when area not found', async () => {
      const areasRepo = makeAreasRepo({ findById: jest.fn().mockResolvedValue(null) });
      const reservationRepo = makeReservationRepo();
      const blockRepo = makeBlockRepo();

      const handler = makeHandler(reservationRepo, blockRepo, areasRepo);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(AreaNotFoundException);

      expect(reservationRepo.listByAreaAndDate).not.toHaveBeenCalled();
      expect(blockRepo.create).not.toHaveBeenCalled();
    });
  });
});
