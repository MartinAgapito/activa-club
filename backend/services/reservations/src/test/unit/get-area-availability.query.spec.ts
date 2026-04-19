import { GetAreaAvailabilityQuery } from '../../application/queries/get-area-availability.query';
import { AreaRecord } from '../../application/ports/areas.repository.interface';
import { MemberRecord } from '../../application/ports/members.repository.interface';
import { SlotOccupancy } from '../../domain/value-objects/slot-occupancy.vo';
import { AreaBlockEntity } from '../../domain/entities/area-block.entity';
import {
  InvalidDateFormatException,
  DateInPastException,
  DateExceedsWindowException,
  AreaNotFoundException,
  MembershipInactiveException,
  AreaNotAccessibleException,
} from '../../domain/exceptions/reservation.exceptions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0);
const TODAY_STR = TODAY.toISOString().slice(0, 10);

const TOMORROW = new Date(TODAY);
TOMORROW.setUTCDate(TODAY.getUTCDate() + 1);
const TOMORROW_STR = TOMORROW.toISOString().slice(0, 10);

const DAY_PLUS_8 = new Date(TODAY);
DAY_PLUS_8.setUTCDate(TODAY.getUTCDate() + 8);
const DAY_PLUS_8_STR = DAY_PLUS_8.toISOString().slice(0, 10);

const YESTERDAY = new Date(TODAY);
YESTERDAY.setUTCDate(TODAY.getUTCDate() - 1);
const YESTERDAY_STR = YESTERDAY.toISOString().slice(0, 10);

// Base area with 09:00–22:00 schedule (13 slots), available to all tiers
const mockAreaVIP: AreaRecord = {
  areaId: 'area-salon',
  name: 'Salon de Eventos',
  status: 'Active',
  capacity: 5,
  slotDuration: 60,
  openingTime: '09:00',
  closingTime: '22:00',
  cancelWindowHours: 2,
  allowedMemberships: ['VIP'],
  maxDurationMinutes: { Silver: 0, Gold: 0, VIP: 240 },
  weeklyLimit: { Silver: 0, Gold: 0, VIP: 5 },
};

const mockAreaSilverGold: AreaRecord = {
  areaId: 'area-tennis',
  name: 'Cancha de Tenis',
  status: 'Active',
  capacity: 4,
  slotDuration: 60,
  openingTime: '09:00',
  closingTime: '22:00',
  cancelWindowHours: 2,
  allowedMemberships: ['Silver', 'Gold', 'VIP'],
  maxDurationMinutes: { Silver: 60, Gold: 120, VIP: 240 },
  weeklyLimit: { Silver: 2, Gold: 3, VIP: 5 },
};

const mockAreaGoldOnly: AreaRecord = {
  areaId: 'area-parrilla',
  name: 'Parrillas',
  status: 'Active',
  capacity: 3,
  slotDuration: 60,
  openingTime: '09:00',
  closingTime: '22:00',
  cancelWindowHours: 2,
  allowedMemberships: ['Gold', 'VIP'],
  maxDurationMinutes: { Gold: 120, VIP: 240 },
  weeklyLimit: { Gold: 3, VIP: 5 },
};

const mockMemberSilver: MemberRecord = {
  pk: 'MEMBER#member-silver',
  memberId: 'member-silver',
  membershipType: 'Silver',
  accountStatus: 'active',
  weeklyReservationCount: 1,
  weeklyResetAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  cognitoUserId: 'sub-silver',
};

const mockMemberGold: MemberRecord = {
  pk: 'MEMBER#member-gold',
  memberId: 'member-gold',
  membershipType: 'Gold',
  accountStatus: 'active',
  weeklyReservationCount: 2,
  weeklyResetAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  cognitoUserId: 'sub-gold',
};

const mockMemberVIP: MemberRecord = {
  pk: 'MEMBER#member-vip',
  memberId: 'member-vip',
  membershipType: 'VIP',
  accountStatus: 'active',
  weeklyReservationCount: 0,
  weeklyResetAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  cognitoUserId: 'sub-vip',
};

// ─── Mock builders ─────────────────────────────────────────────────────────────

function makeEmptyOccupancyMap(startTimes: string[], capacity: number): Map<string, SlotOccupancy> {
  const map = new Map<string, SlotOccupancy>();
  for (const t of startTimes) {
    map.set(t, new SlotOccupancy(0, capacity));
  }
  return map;
}

function makeFullOccupancyMap(startTimes: string[], capacity: number): Map<string, SlotOccupancy> {
  const map = new Map<string, SlotOccupancy>();
  for (const t of startTimes) {
    map.set(t, new SlotOccupancy(capacity, capacity));
  }
  return map;
}

function makeBlock(areaId: string, startTime: string, endTime: string): AreaBlockEntity {
  return new AreaBlockEntity({
    blockId: 'block-01',
    areaId,
    date: TOMORROW_STR,
    startTime,
    endTime,
    reason: 'Maintenance',
    createdBy: 'admin-01',
    createdAt: new Date().toISOString(),
    isActive: true,
  });
}

function makeQuery({
  reservationRepo = { findKeysByReservationId: jest.fn(), findByKey: jest.fn(), listByMember: jest.fn(), listByAreaAndDate: jest.fn(), findExpiredConfirmed: jest.fn(), createWithTransaction: jest.fn(), cancelWithTransaction: jest.fn(), expireWithTransaction: jest.fn(), batchCancelWithTransaction: jest.fn() },
  slotOccupancyRepo = { batchGetSlotOccupancies: jest.fn(), getSlotOccupancy: jest.fn() },
  areaBlockRepo = { listByAreaAndDate: jest.fn().mockResolvedValue([]), findKeysByBlockId: jest.fn(), create: jest.fn(), deactivate: jest.fn() },
  areasRepo = { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
  membersRepo = { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
}: {
  reservationRepo?: any;
  slotOccupancyRepo?: any;
  areaBlockRepo?: any;
  areasRepo?: any;
  membersRepo?: any;
} = {}) {
  return new GetAreaAvailabilityQuery(
    reservationRepo,
    slotOccupancyRepo,
    areaBlockRepo,
    areasRepo,
    membersRepo,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GetAreaAvailabilityQuery — AC-011', () => {

  // ── Date validation ──────────────────────────────────────────────────────────

  describe('Date validation', () => {
    it('throws InvalidDateFormatException for a non-YYYY-MM-DD string', async () => {
      const query = makeQuery();
      await expect(
        query.execute({
          areaId: 'area-tennis',
          date: '20260410',
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(InvalidDateFormatException);
    });

    it('throws DateInPastException when date is yesterday', async () => {
      const query = makeQuery();
      await expect(
        query.execute({
          areaId: 'area-tennis',
          date: YESTERDAY_STR,
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(DateInPastException);
    });

    it('throws DateExceedsWindowException when Member queries 8 days ahead', async () => {
      const query = makeQuery({
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap([], 4)), getSlotOccupancy: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-tennis',
          date: DAY_PLUS_8_STR,
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(DateExceedsWindowException);
    });

    it('allows Manager to query a date beyond 7 days', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
        areaBlockRepo: { listByAreaAndDate: jest.fn().mockResolvedValue([]), findKeysByBlockId: jest.fn(), create: jest.fn(), deactivate: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: DAY_PLUS_8_STR,
        callerMemberId: 'manager-01',
        callerRole: 'Manager',
        callerMembershipType: 'Gold',
      });

      expect(result).toBeDefined();
      expect(result.slots.length).toBe(13);
    });
  });

  // ── Area not found ───────────────────────────────────────────────────────────

  describe('Area not found', () => {
    it('throws AreaNotFoundException when area does not exist in DynamoDB', async () => {
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(null), findAllActive: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-nonexistent',
          date: TOMORROW_STR,
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(AreaNotFoundException);
    });

    it('throws AreaNotFoundException when area status is Inactive', async () => {
      const inactiveArea = { ...mockAreaSilverGold, status: 'Inactive' };
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(inactiveArea), findAllActive: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-tennis',
          date: TOMORROW_STR,
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(AreaNotFoundException);
    });
  });

  // ── Membership access control ────────────────────────────────────────────────

  describe('Membership access — AC-011 (Silver)', () => {
    it('allows Silver member to query Cancha de Tenis (allowed)', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      expect(result.areaId).toBe('area-tennis');
      expect(result.slots.every((s) => s.status === 'AVAILABLE')).toBe(true);
      expect(result.weeklyQuotaInfo).toBeDefined();
      expect(result.weeklyQuotaInfo!.used).toBe(1);
      expect(result.weeklyQuotaInfo!.limit).toBe(2);
    });

    it('throws AreaNotAccessibleException when Silver member queries Parrillas (Gold-only)', async () => {
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaGoldOnly), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-parrilla',
          date: TOMORROW_STR,
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(AreaNotAccessibleException);
    });

    it('throws AreaNotAccessibleException when Silver member queries VIP-only area (Salon)', async () => {
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaVIP), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-salon',
          date: TOMORROW_STR,
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(AreaNotAccessibleException);
    });
  });

  describe('Membership access — AC-011 (Gold)', () => {
    it('allows Gold member to query Parrillas (allowed)', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaGoldOnly), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberGold), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 3)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-parrilla',
        date: TOMORROW_STR,
        callerMemberId: 'member-gold',
        callerRole: 'Member',
        callerMembershipType: 'Gold',
      });

      expect(result.areaId).toBe('area-parrilla');
      expect(result.weeklyQuotaInfo!.limit).toBe(3);
      expect(result.weeklyQuotaInfo!.used).toBe(2);
    });

    it('throws AreaNotAccessibleException when Gold member queries VIP-only Salon', async () => {
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaVIP), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberGold), findByCognitoSub: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-salon',
          date: TOMORROW_STR,
          callerMemberId: 'member-gold',
          callerRole: 'Member',
          callerMembershipType: 'Gold',
        }),
      ).rejects.toThrow(AreaNotAccessibleException);
    });
  });

  describe('Membership access — AC-011 (VIP)', () => {
    it('allows VIP member to query all areas including Salon de Eventos', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaVIP), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberVIP), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 5)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-salon',
        date: TOMORROW_STR,
        callerMemberId: 'member-vip',
        callerRole: 'Member',
        callerMembershipType: 'VIP',
      });

      expect(result.areaId).toBe('area-salon');
      expect(result.weeklyQuotaInfo!.limit).toBe(5);
    });
  });

  // ── Inactive membership ──────────────────────────────────────────────────────

  describe('Inactive membership — AC-011', () => {
    it('throws MembershipInactiveException when member account_status is suspended', async () => {
      const suspendedMember = { ...mockMemberSilver, accountStatus: 'suspended' };
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(suspendedMember), findByCognitoSub: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-tennis',
          date: TOMORROW_STR,
          callerMemberId: 'member-silver',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(MembershipInactiveException);
    });

    it('throws MembershipInactiveException when member record not found', async () => {
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(null), findByCognitoSub: jest.fn() },
      });
      await expect(
        query.execute({
          areaId: 'area-tennis',
          date: TOMORROW_STR,
          callerMemberId: 'member-unknown',
          callerRole: 'Member',
          callerMembershipType: 'Silver',
        }),
      ).rejects.toThrow(MembershipInactiveException);
    });
  });

  // ── Administrative blocks (opaque to Member) ─────────────────────────────────

  describe('Administrative blocks — AC-011', () => {
    it('marks blocked slots as BLOCKED and available=0 when an active block covers the slot', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      // Block covers 11:00–12:00
      const block = makeBlock('area-tennis', '11:00', '12:00');
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
        areaBlockRepo: { listByAreaAndDate: jest.fn().mockResolvedValue([block]), findKeysByBlockId: jest.fn(), create: jest.fn(), deactivate: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      const blockedSlot = result.slots.find((s) => s.startTime === '11:00');
      expect(blockedSlot).toBeDefined();
      expect(blockedSlot!.status).toBe('BLOCKED');
      expect(blockedSlot!.blocked).toBe(true);
      expect(blockedSlot!.available).toBe(0);

      // Other slots should still be AVAILABLE
      const normalSlot = result.slots.find((s) => s.startTime === '09:00');
      expect(normalSlot!.status).toBe('AVAILABLE');
    });

    it('marks multiple consecutive blocked slots when block covers 2 hours (11:00–13:00)', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const block = makeBlock('area-tennis', '11:00', '13:00');
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
        areaBlockRepo: { listByAreaAndDate: jest.fn().mockResolvedValue([block]), findKeysByBlockId: jest.fn(), create: jest.fn(), deactivate: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      const slot11 = result.slots.find((s) => s.startTime === '11:00');
      const slot12 = result.slots.find((s) => s.startTime === '12:00');
      const slot13 = result.slots.find((s) => s.startTime === '13:00');

      expect(slot11!.status).toBe('BLOCKED');
      expect(slot12!.status).toBe('BLOCKED');
      // 13:00 is endTime — NOT covered by the block [11:00, 13:00)
      expect(slot13!.status).toBe('AVAILABLE');
    });
  });

  // ── Slot fully booked (FULL) ─────────────────────────────────────────────────

  describe('Slot fully booked — AC-011', () => {
    it('marks slot as FULL when occupancy equals capacity', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const occupancyMap = makeEmptyOccupancyMap(slotTimes, 4);
      // Fill 10:00 slot completely
      occupancyMap.set('10:00', new SlotOccupancy(4, 4));
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(occupancyMap), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      const fullSlot = result.slots.find((s) => s.startTime === '10:00');
      expect(fullSlot!.status).toBe('FULL');
      expect(fullSlot!.available).toBe(0);
      expect(fullSlot!.blocked).toBe(false);
    });

    it('returns available > 0 for partially occupied slot', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const occupancyMap = makeEmptyOccupancyMap(slotTimes, 4);
      occupancyMap.set('10:00', new SlotOccupancy(2, 4)); // 2 of 4 taken
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(occupancyMap), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      const partialSlot = result.slots.find((s) => s.startTime === '10:00');
      expect(partialSlot!.status).toBe('AVAILABLE');
      expect(partialSlot!.available).toBe(2);
    });
  });

  // ── No SlotOccupancy records (never booked) ──────────────────────────────────

  describe('No occupancy records (area never booked) — AC-011', () => {
    it('treats all slots as AVAILABLE with occupancy=0 when no SlotOccupancyTable records exist', async () => {
      // Simulate DynamoDB returning empty map (no records) → defaults handled in repository
      // which the mock simulates by returning SlotOccupancy(0, capacity) for every slot
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const emptyDefaults = makeEmptyOccupancyMap(slotTimes, 4);
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(emptyDefaults), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      expect(result.slots).toHaveLength(13); // 09:00–22:00
      expect(result.slots.every((s) => s.status === 'AVAILABLE')).toBe(true);
      expect(result.slots.every((s) => s.available === 4)).toBe(true);
    });
  });

  // ── Weekly quota info ────────────────────────────────────────────────────────

  describe('Weekly quota — AC-011', () => {
    it('includes weeklyQuotaInfo in response for Member callers', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      expect(result.weeklyQuotaInfo).toBeDefined();
      expect(result.weeklyQuotaInfo!.exhausted).toBe(false);
    });

    it('sets exhausted=true when Member has used all weekly quota', async () => {
      const exhaustedMember = { ...mockMemberSilver, weeklyReservationCount: 2 }; // Silver limit = 2
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(exhaustedMember), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      // Query still returns 200 OK — exhausted is informational only
      expect(result.weeklyQuotaInfo!.exhausted).toBe(true);
      expect(result.slots.length).toBe(13);
    });

    it('omits weeklyQuotaInfo from response for Manager callers', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'manager-01',
        callerRole: 'Manager',
        callerMembershipType: 'Gold',
      });

      expect(result.weeklyQuotaInfo).toBeUndefined();
    });

    it('omits weeklyQuotaInfo from response for Admin callers', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'admin-01',
        callerRole: 'Admin',
        callerMembershipType: 'VIP',
      });

      expect(result.weeklyQuotaInfo).toBeUndefined();
    });
  });

  // ── Response shape ───────────────────────────────────────────────────────────

  describe('Response shape — AC-011', () => {
    it('generates 13 hourly slots for a 09:00–22:00 area schedule', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      expect(result.slots).toHaveLength(13);
      expect(result.slots[0].startTime).toBe('09:00');
      expect(result.slots[0].endTime).toBe('10:00');
      expect(result.slots[12].startTime).toBe('21:00');
      expect(result.slots[12].endTime).toBe('22:00');
    });

    it('response includes areaId, areaName, date, and capacity fields', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TOMORROW_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      expect(result.areaId).toBe('area-tennis');
      expect(result.areaName).toBe('Cancha de Tenis');
      expect(result.date).toBe(TOMORROW_STR);
      expect(result.capacity).toBe(4);
    });
  });

  // ── Today is valid ───────────────────────────────────────────────────────────

  describe('Today as date — AC-011', () => {
    it('accepts today as a valid date (not in past)', async () => {
      const slotTimes = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
      const query = makeQuery({
        areasRepo: { findById: jest.fn().mockResolvedValue(mockAreaSilverGold), findAllActive: jest.fn() },
        membersRepo: { findById: jest.fn().mockResolvedValue(mockMemberSilver), findByCognitoSub: jest.fn() },
        slotOccupancyRepo: { batchGetSlotOccupancies: jest.fn().mockResolvedValue(makeEmptyOccupancyMap(slotTimes, 4)), getSlotOccupancy: jest.fn() },
      });

      const result = await query.execute({
        areaId: 'area-tennis',
        date: TODAY_STR,
        callerMemberId: 'member-silver',
        callerRole: 'Member',
        callerMembershipType: 'Silver',
      });

      expect(result).toBeDefined();
      expect(result.date).toBe(TODAY_STR);
    });
  });
});
