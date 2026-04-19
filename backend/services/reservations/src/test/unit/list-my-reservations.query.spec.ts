import { ListMyReservationsQuery, ListMyReservationsInput } from '../../application/queries/list-my-reservations.query';
import { ReservationRepositoryInterface } from '../../domain/repositories/reservation.repository.interface';
import { MembersRepositoryInterface, MemberRecord } from '../../application/ports/members.repository.interface';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import { ReservationStatus } from '../../domain/value-objects/reservation-status.vo';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBER_ID = 'member-01';

function makeMember(overrides: Partial<MemberRecord> = {}): MemberRecord {
  const nextMonday = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  return {
    pk: `MEMBER#${MEMBER_ID}`,
    memberId: MEMBER_ID,
    membershipType: 'Gold',
    accountStatus: 'active',
    weeklyReservationCount: 1,
    weeklyResetAt: nextMonday,
    cognitoUserId: 'cognito-sub-01',
    ...overrides,
  };
}

function makeReservation(hoursUntilStart: number, status: ReservationStatus = ReservationStatus.CONFIRMED): ReservationEntity {
  const future = new Date(Date.now() + hoursUntilStart * 3600 * 1000);
  const date = future.toISOString().slice(0, 10);
  const h = String(future.getUTCHours()).padStart(2, '0');
  const m = String(future.getUTCMinutes()).padStart(2, '0');
  const startTime = `${h}:${m}`;

  return new ReservationEntity({
    reservationId: 'res-01',
    memberId: MEMBER_ID,
    areaId: 'area-01',
    areaName: 'Cancha de Tenis',
    date,
    startTime,
    endTime: '10:00',
    durationMinutes: 60,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  });
}

function makeReservationRepo(
  items: ReservationEntity[] = [],
  lastKey: string | null = null,
): jest.Mocked<ReservationRepositoryInterface> {
  return {
    findKeysByReservationId: jest.fn(),
    findByKey: jest.fn(),
    listByMember: jest.fn().mockResolvedValue({ items, lastKey }),
    listByAreaAndDate: jest.fn(),
    findExpiredConfirmed: jest.fn(),
    createWithTransaction: jest.fn(),
    cancelWithTransaction: jest.fn(),
    expireWithTransaction: jest.fn(),
    batchCancelWithTransaction: jest.fn(),
  } as unknown as jest.Mocked<ReservationRepositoryInterface>;
}

function makeMembersRepo(
  member: MemberRecord | null = makeMember(),
): jest.Mocked<MembersRepositoryInterface> {
  return {
    findById: jest.fn().mockResolvedValue(member),
    findByCognitoSub: jest.fn(),
  } as unknown as jest.Mocked<MembersRepositoryInterface>;
}

function makeQuery(
  reservationRepo: jest.Mocked<ReservationRepositoryInterface>,
  membersRepo: jest.Mocked<MembersRepositoryInterface>,
): ListMyReservationsQuery {
  return new ListMyReservationsQuery(reservationRepo, membersRepo);
}

const BASE_INPUT: ListMyReservationsInput = {
  memberId: MEMBER_ID,
  membershipType: 'Gold',
  view: 'upcoming',
  limit: 20,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ListMyReservationsQuery — AC-014', () => {
  describe('Upcoming view — happy path', () => {
    it('returns empty items list when member has no upcoming reservations', async () => {
      const query = makeQuery(makeReservationRepo([]), makeMembersRepo());

      const result = await query.execute(BASE_INPUT);

      expect(result.items).toHaveLength(0);
      expect(result.lastKey).toBeNull();
      expect(result.membershipStatus).toBe('active');
    });

    it('includes weeklyQuota with used=1 and limit=3 for Gold membership', async () => {
      const query = makeQuery(makeReservationRepo([]), makeMembersRepo(makeMember({ weeklyReservationCount: 1 })));

      const result = await query.execute(BASE_INPUT);

      expect(result.weeklyQuota.used).toBe(1);
      expect(result.weeklyQuota.limit).toBe(3); // Gold = 3
      expect(result.weeklyQuota.resetsAt).toBeTruthy();
    });

    it('returns correct weeklyLimit for Silver membership (2)', async () => {
      const member = makeMember({ membershipType: 'Silver', weeklyReservationCount: 0 });
      const query = makeQuery(makeReservationRepo([]), makeMembersRepo(member));

      const result = await query.execute({ ...BASE_INPUT, membershipType: 'Silver' });

      expect(result.weeklyQuota.limit).toBe(2);
    });

    it('returns correct weeklyLimit for VIP membership (5)', async () => {
      const member = makeMember({ membershipType: 'VIP', weeklyReservationCount: 0 });
      const query = makeQuery(makeReservationRepo([]), makeMembersRepo(member));

      const result = await query.execute({ ...BASE_INPUT, membershipType: 'VIP' });

      expect(result.weeklyQuota.limit).toBe(5);
    });
  });

  describe('canCancel field — AC-014', () => {
    it('sets canCancel=true for a CONFIRMED reservation more than 2 hours away', async () => {
      const reservation = makeReservation(3, ReservationStatus.CONFIRMED); // 3h from now
      const query = makeQuery(makeReservationRepo([reservation]), makeMembersRepo());

      const result = await query.execute(BASE_INPUT);

      expect(result.items[0].canCancel).toBe(true);
    });

    it('sets canCancel=false for a CONFIRMED reservation less than 2 hours away', async () => {
      const reservation = makeReservation(1, ReservationStatus.CONFIRMED); // 1h from now
      const query = makeQuery(makeReservationRepo([reservation]), makeMembersRepo());

      const result = await query.execute(BASE_INPUT);

      expect(result.items[0].canCancel).toBe(false);
    });

    it('sets canCancel=false for a CANCELLED reservation', async () => {
      const reservation = makeReservation(5, ReservationStatus.CANCELLED);
      const query = makeQuery(makeReservationRepo([reservation]), makeMembersRepo());

      const result = await query.execute(BASE_INPUT);

      expect(result.items[0].canCancel).toBe(false);
    });

    it('sets canCancel=false for an EXPIRED reservation', async () => {
      const reservation = makeReservation(5, ReservationStatus.EXPIRED);
      const query = makeQuery(makeReservationRepo([reservation]), makeMembersRepo());

      const result = await query.execute(BASE_INPUT);

      expect(result.items[0].canCancel).toBe(false);
    });
  });

  describe('History pagination — AC-014', () => {
    it('returns nextKey when there are more pages', async () => {
      const reservation = makeReservation(-1, ReservationStatus.CANCELLED); // past
      const cursor = Buffer.from(JSON.stringify({ pk: 'RESERVATION#res-01', sk: 'MEMBER#member-01' })).toString('base64');
      const query = makeQuery(makeReservationRepo([reservation], cursor), makeMembersRepo());

      const result = await query.execute({ ...BASE_INPUT, view: 'history' });

      expect(result.lastKey).toBe(cursor);
    });

    it('returns lastKey=null when there are no more pages', async () => {
      const query = makeQuery(makeReservationRepo([]), makeMembersRepo());

      const result = await query.execute({ ...BASE_INPUT, view: 'history' });

      expect(result.lastKey).toBeNull();
    });
  });

  describe('Inactive membership — AC-014', () => {
    it('still returns the list when membership is suspended (no exception thrown)', async () => {
      const inactiveMember = makeMember({ accountStatus: 'suspended' });
      const reservation = makeReservation(5, ReservationStatus.CONFIRMED);
      const query = makeQuery(makeReservationRepo([reservation]), makeMembersRepo(inactiveMember));

      // AC-014: unlike AC-012, this endpoint does NOT block inactive members.
      const result = await query.execute(BASE_INPUT);

      expect(result.items).toHaveLength(1);
      expect(result.membershipStatus).toBe('suspended');
    });

    it('returns membershipStatus=suspended for a suspended member', async () => {
      const inactiveMember = makeMember({ accountStatus: 'suspended' });
      const query = makeQuery(makeReservationRepo([]), makeMembersRepo(inactiveMember));

      const result = await query.execute(BASE_INPUT);

      expect(result.membershipStatus).toBe('suspended');
    });
  });

  describe('Stale weekly counter — AC-014', () => {
    it('reports used=0 when weeklyResetAt is in the past (counter is stale)', async () => {
      const pastResetAt = new Date(Date.now() - 86400 * 1000).toISOString(); // yesterday
      const member = makeMember({ weeklyReservationCount: 3, weeklyResetAt: pastResetAt });
      const query = makeQuery(makeReservationRepo([]), makeMembersRepo(member));

      const result = await query.execute(BASE_INPUT);

      // The Lambda detects the stale counter and reports used=0
      expect(result.weeklyQuota.used).toBe(0);
    });
  });

  describe('Response shape — AC-014', () => {
    it('includes durationMinutes in each item', async () => {
      const reservation = makeReservation(5, ReservationStatus.CONFIRMED);
      const query = makeQuery(makeReservationRepo([reservation]), makeMembersRepo());

      const result = await query.execute(BASE_INPUT);

      expect(result.items[0]).toHaveProperty('durationMinutes');
      expect(result.items[0].durationMinutes).toBe(60);
    });

    it('includes areaName in each item', async () => {
      const reservation = makeReservation(5, ReservationStatus.CONFIRMED);
      const query = makeQuery(makeReservationRepo([reservation]), makeMembersRepo());

      const result = await query.execute(BASE_INPUT);

      expect(result.items[0].areaName).toBe('Cancha de Tenis');
    });
  });
});
