import {
  ExpireReservationsUseCase,
  ExpirationRepository,
  ExpiredReservation,
} from '../../application/expire-reservations.use-case';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeExpiredReservation(overrides: Partial<ExpiredReservation> = {}): ExpiredReservation {
  return {
    reservationId: 'res-01',
    memberId: 'member-01',
    areaId: 'area-01',
    date: '2026-04-19',
    startTime: '08:00',
    endTime: '09:00',
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<ExpirationRepository> = {},
): jest.Mocked<ExpirationRepository> {
  return {
    findConfirmedExpiredReservations: jest.fn().mockResolvedValue([]),
    markAsExpired: jest.fn().mockResolvedValue(undefined),
    releaseSlotOccupancy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<ExpirationRepository>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExpireReservationsUseCase — AC-016', () => {
  describe('Caso 1: repositorio retorna 0 reservas → processed=0, errors=0', () => {
    it('returns processed=0 and errors=0 when no expired reservations exist', async () => {
      const repo = makeRepository();
      const useCase = new ExpireReservationsUseCase(repo);

      const result = await useCase.execute();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.failedIds).toHaveLength(0);
    });

    it('does not call markAsExpired or releaseSlotOccupancy when list is empty', async () => {
      const repo = makeRepository();
      const useCase = new ExpireReservationsUseCase(repo);

      await useCase.execute();

      expect(repo.markAsExpired).not.toHaveBeenCalled();
      expect(repo.releaseSlotOccupancy).not.toHaveBeenCalled();
    });
  });

  describe('Caso 2: 3 reservas expiradas → las 3 procesadas, processed=3, errors=0', () => {
    it('processes all 3 reservations and returns processed=3, errors=0', async () => {
      const reservations = [
        makeExpiredReservation({ reservationId: 'res-01' }),
        makeExpiredReservation({ reservationId: 'res-02' }),
        makeExpiredReservation({ reservationId: 'res-03' }),
      ];
      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
      });
      const useCase = new ExpireReservationsUseCase(repo);

      const result = await useCase.execute();

      expect(result.processed).toBe(3);
      expect(result.errors).toBe(0);
      expect(result.failedIds).toHaveLength(0);
    });

    it('calls markAsExpired once per reservation with correct arguments', async () => {
      const reservations = [
        makeExpiredReservation({ reservationId: 'res-01', areaId: 'area-01', date: '2026-04-19', startTime: '08:00' }),
        makeExpiredReservation({ reservationId: 'res-02', areaId: 'area-01', date: '2026-04-19', startTime: '09:00' }),
      ];
      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
      });
      const useCase = new ExpireReservationsUseCase(repo);

      await useCase.execute();

      expect(repo.markAsExpired).toHaveBeenCalledTimes(2);
      expect(repo.markAsExpired).toHaveBeenCalledWith('res-01', 'area-01', '2026-04-19', '08:00');
      expect(repo.markAsExpired).toHaveBeenCalledWith('res-02', 'area-01', '2026-04-19', '09:00');
    });

    it('calls releaseSlotOccupancy once per reservation with correct arguments', async () => {
      const reservations = [
        makeExpiredReservation({ reservationId: 'res-01', areaId: 'area-01', date: '2026-04-19', startTime: '08:00' }),
      ];
      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
      });
      const useCase = new ExpireReservationsUseCase(repo);

      await useCase.execute();

      expect(repo.releaseSlotOccupancy).toHaveBeenCalledTimes(1);
      expect(repo.releaseSlotOccupancy).toHaveBeenCalledWith('area-01', '2026-04-19', '08:00');
    });
  });

  describe('Caso 3: error en 1 de 3 → processed=2, errors=1, failedIds tiene el id fallido', () => {
    it('continues processing when one reservation fails and reports it in failedIds', async () => {
      const reservations = [
        makeExpiredReservation({ reservationId: 'res-01' }),
        makeExpiredReservation({ reservationId: 'res-02' }),
        makeExpiredReservation({ reservationId: 'res-03' }),
      ];

      const genericError = new Error('DynamoDB service unavailable');

      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
        markAsExpired: jest
          .fn()
          // res-01: success, res-02: throws generic error, res-03: success
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(genericError)
          .mockResolvedValueOnce(undefined),
      });
      const useCase = new ExpireReservationsUseCase(repo);

      const result = await useCase.execute();

      expect(result.processed).toBe(2);
      expect(result.errors).toBe(1);
      expect(result.failedIds).toEqual(['res-02']);
    });

    it('still calls markAsExpired for subsequent reservations after one failure', async () => {
      const reservations = [
        makeExpiredReservation({ reservationId: 'res-01' }),
        makeExpiredReservation({ reservationId: 'res-02' }),
      ];

      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
        markAsExpired: jest
          .fn()
          .mockRejectedValueOnce(new Error('Transient error'))
          .mockResolvedValueOnce(undefined),
      });
      const useCase = new ExpireReservationsUseCase(repo);

      await useCase.execute();

      expect(repo.markAsExpired).toHaveBeenCalledTimes(2);
    });

    it('does not call releaseSlotOccupancy when markAsExpired fails with generic error', async () => {
      const reservations = [makeExpiredReservation({ reservationId: 'res-01' })];

      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
        markAsExpired: jest.fn().mockRejectedValue(new Error('Service error')),
      });
      const useCase = new ExpireReservationsUseCase(repo);

      await useCase.execute();

      expect(repo.releaseSlotOccupancy).not.toHaveBeenCalled();
    });
  });

  describe('Caso 4: ConditionalCheckFailedException → NO cuenta como error (idempotencia)', () => {
    it('counts as processed (not error) when markAsExpired throws ConditionalCheckFailedException', async () => {
      const reservations = [makeExpiredReservation({ reservationId: 'res-already-expired' })];

      const conditionalError = Object.assign(new Error('The conditional request failed'), {
        name: 'ConditionalCheckFailedException',
      });

      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
        markAsExpired: jest.fn().mockRejectedValue(conditionalError),
      });
      const useCase = new ExpireReservationsUseCase(repo);

      const result = await useCase.execute();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.failedIds).toHaveLength(0);
    });

    it('does not add reservationId to failedIds on ConditionalCheckFailedException', async () => {
      const reservations = [
        makeExpiredReservation({ reservationId: 'res-01' }),
        makeExpiredReservation({ reservationId: 'res-idempotent' }),
      ];

      const conditionalError = Object.assign(new Error('The conditional request failed'), {
        name: 'ConditionalCheckFailedException',
      });

      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
        markAsExpired: jest
          .fn()
          .mockResolvedValueOnce(undefined)        // res-01: success
          .mockRejectedValueOnce(conditionalError), // res-idempotent: already expired
      });
      const useCase = new ExpireReservationsUseCase(repo);

      const result = await useCase.execute();

      expect(result.processed).toBe(2);
      expect(result.errors).toBe(0);
      expect(result.failedIds).toHaveLength(0);
    });

    it('distinguishes ConditionalCheckFailedException from other DynamoDB errors', async () => {
      const reservations = [
        makeExpiredReservation({ reservationId: 'res-conditional' }),
        makeExpiredReservation({ reservationId: 'res-service-error' }),
      ];

      const conditionalError = Object.assign(new Error('Conditional check failed'), {
        name: 'ConditionalCheckFailedException',
      });
      const serviceError = Object.assign(new Error('Service unavailable'), {
        name: 'ServiceUnavailableException',
      });

      const repo = makeRepository({
        findConfirmedExpiredReservations: jest.fn().mockResolvedValue(reservations),
        markAsExpired: jest
          .fn()
          .mockRejectedValueOnce(conditionalError)  // treated as success
          .mockRejectedValueOnce(serviceError),      // treated as error
      });
      const useCase = new ExpireReservationsUseCase(repo);

      const result = await useCase.execute();

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.failedIds).toEqual(['res-service-error']);
    });
  });
});
