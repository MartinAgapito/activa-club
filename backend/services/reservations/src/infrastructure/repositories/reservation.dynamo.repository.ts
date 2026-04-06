import { Injectable, Logger } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  ReservationRepositoryInterface,
  ReservationCreatePayload,
  ReservationCancelPayload,
  ReservationListOptions,
  ReservationListResult,
} from '../../domain/repositories/reservation.repository.interface';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import {
  ReservationStatus,
  isReservationStatus,
} from '../../domain/value-objects/reservation-status.vo';
import { SlotFullException } from '../../domain/exceptions/reservation.exceptions';

/**
 * DynamoDB item shape for ReservationsTable.
 */
interface ReservationDynamoItem {
  pk: string;
  sk: string;
  reservation_id: string;
  member_id: string;
  area_id: string;
  area_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  cancel_reason?: string;
  cancelled_by_role?: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

function toDomain(item: ReservationDynamoItem): ReservationEntity {
  return new ReservationEntity({
    reservationId: item.reservation_id,
    memberId: item.member_id,
    areaId: item.area_id,
    areaName: item.area_name,
    date: item.date,
    startTime: item.start_time,
    endTime: item.end_time,
    durationMinutes: item.duration_minutes,
    status: isReservationStatus(item.status) ? item.status : ReservationStatus.CONFIRMED,
    cancelReason: item.cancel_reason,
    cancelledByRole: item.cancelled_by_role as 'MEMBER' | 'MANAGER' | undefined,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    expiresAt: item.expires_at,
  });
}

@Injectable()
export class ReservationDynamoRepository implements ReservationRepositoryInterface {
  private readonly logger = new Logger(ReservationDynamoRepository.name);
  private readonly tableName: string;
  private readonly slotOccupancyTableName: string;
  private readonly membersTableName: string;

  constructor(private readonly client: DynamoDBDocumentClient) {
    this.tableName = process.env.RESERVATIONS_TABLE_NAME!;
    this.slotOccupancyTableName = process.env.SLOT_OCCUPANCY_TABLE_NAME!;
    this.membersTableName = process.env.MEMBERS_TABLE_NAME!;

    if (!this.tableName) throw new Error('RESERVATIONS_TABLE_NAME is not set');
    if (!this.slotOccupancyTableName) throw new Error('SLOT_OCCUPANCY_TABLE_NAME is not set');
    if (!this.membersTableName) throw new Error('MEMBERS_TABLE_NAME is not set');
  }

  async findKeysByReservationId(reservationId: string): Promise<{ pk: string; sk: string } | null> {
    this.logger.debug(`findKeysByReservationId: reservationId=${reservationId}`);

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI_ReservationId',
          KeyConditionExpression: 'reservation_id = :rid',
          ExpressionAttributeValues: { ':rid': reservationId },
          Limit: 1,
        }),
      );

      if (!result.Items || result.Items.length === 0) return null;

      const item = result.Items[0] as { pk: string; sk: string };
      return { pk: item.pk, sk: item.sk };
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_ReservationId', this.tableName);
    }
  }

  async findByKey(pk: string, sk: string): Promise<ReservationEntity | null> {
    this.logger.debug(`findByKey: pk=${pk}`);

    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk, sk },
        }),
      );

      if (!result.Item) return null;
      return toDomain(result.Item as ReservationDynamoItem);
    } catch (error) {
      throw this.wrapError(error, 'GetItem', this.tableName);
    }
  }

  async listByMember(options: ReservationListOptions): Promise<ReservationListResult> {
    this.logger.debug(
      `listByMember: memberId=${options.memberId} view=${options.view} limit=${options.limit}`,
    );

    const isUpcoming = options.view === 'upcoming';
    const statusFilter = isUpcoming ? 'CONFIRMED' : undefined; // history = CANCELLED + EXPIRED (filter expression)

    let exclusiveStartKey: Record<string, unknown> | undefined;
    if (options.lastKey) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(options.lastKey, 'base64').toString('utf8'));
      } catch {
        exclusiveStartKey = undefined;
      }
    }

    try {
      const params: Parameters<typeof QueryCommand>[0] = {
        TableName: this.tableName,
        IndexName: 'GSI_Member',
        KeyConditionExpression: 'member_id = :mid',
        ExpressionAttributeValues: { ':mid': options.memberId },
        ScanIndexForward: false, // Most recent first
        Limit: options.limit,
        ExclusiveStartKey: exclusiveStartKey as Record<string, any> | undefined,
      };

      if (isUpcoming) {
        params.FilterExpression = '#st = :status';
        params.ExpressionAttributeNames = { '#st': 'status' };
        (params.ExpressionAttributeValues as Record<string, unknown>)[':status'] = 'CONFIRMED';
      } else {
        params.FilterExpression = '#st IN (:c, :e)';
        params.ExpressionAttributeNames = { '#st': 'status' };
        (params.ExpressionAttributeValues as Record<string, unknown>)[':c'] = 'CANCELLED';
        (params.ExpressionAttributeValues as Record<string, unknown>)[':e'] = 'EXPIRED';
      }

      const result = await this.client.send(new QueryCommand(params));
      const items = (result.Items ?? []).map((i) => toDomain(i as ReservationDynamoItem));

      let lastKey: string | null = null;
      if (result.LastEvaluatedKey) {
        lastKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
      }

      return { items, lastKey };
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_Member', this.tableName);
    }
  }

  async listByAreaAndDate(areaId: string, date: string): Promise<ReservationEntity[]> {
    this.logger.debug(`listByAreaAndDate: areaId=${areaId} date=${date}`);

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI_AreaDate',
          KeyConditionExpression: 'area_id = :aid AND #d = :date',
          ExpressionAttributeNames: { '#d': 'date' },
          ExpressionAttributeValues: { ':aid': areaId, ':date': date },
        }),
      );

      return (result.Items ?? []).map((i) => toDomain(i as ReservationDynamoItem));
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_AreaDate', this.tableName);
    }
  }

  async findExpiredConfirmed(thresholdIso: string): Promise<ReservationEntity[]> {
    this.logger.debug(`findExpiredConfirmed: threshold=${thresholdIso}`);

    const items: ReservationEntity[] = [];
    let lastKey: Record<string, unknown> | undefined;

    try {
      do {
        const result = await this.client.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI_StatusExpires',
            KeyConditionExpression: '#st = :confirmed AND expires_at <= :threshold',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':confirmed': 'CONFIRMED',
              ':threshold': thresholdIso,
            },
            ExclusiveStartKey: lastKey as Record<string, any> | undefined,
          }),
        );

        for (const item of result.Items ?? []) {
          // GSI_StatusExpires is KEYS_ONLY — fetch full item
          const full = await this.findByKey(
            (item as { pk: string }).pk,
            (item as { sk: string }).sk,
          );
          if (full) items.push(full);
        }

        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (lastKey);

      return items;
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_StatusExpires', this.tableName);
    }
  }

  async createWithTransaction(payload: ReservationCreatePayload): Promise<ReservationEntity> {
    this.logger.debug(`createWithTransaction: reservationId=${payload.reservationId}`);

    const now = new Date().toISOString();
    const slotPk = `SLOT#${payload.areaId}#${payload.date}#${payload.startTime}`;
    const reservationPk = `RESERVATION#${payload.reservationId}`;
    const reservationSk = `MEMBER#${payload.memberId}`;
    const memberPk = `MEMBER#${payload.memberId}`;
    const memberSk = 'PROFILE';

    const reservationItem: ReservationDynamoItem = {
      pk: reservationPk,
      sk: reservationSk,
      reservation_id: payload.reservationId,
      member_id: payload.memberId,
      area_id: payload.areaId,
      area_name: payload.areaName,
      date: payload.date,
      start_time: payload.startTime,
      end_time: payload.endTime,
      duration_minutes: payload.durationMinutes,
      status: ReservationStatus.CONFIRMED,
      created_at: now,
      updated_at: now,
      expires_at: payload.expiresAt,
    };

    // Build member update expression (with optional weekly reset)
    let memberUpdateExpression: string;
    let memberExpressionValues: Record<string, unknown>;

    if (payload.needsWeeklyReset) {
      memberUpdateExpression =
        'SET weekly_reservation_count = :one, weekly_reset_at = :nextMonday, updated_at = :now';
      memberExpressionValues = {
        ':one': 1,
        ':nextMonday': payload.memberWeeklyResetAt,
        ':now': now,
      };
    } else {
      memberUpdateExpression = 'ADD weekly_reservation_count :inc SET updated_at = :now';
      memberExpressionValues = {
        ':inc': 1,
        ':now': now,
      };
    }

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            // ── (a+b) Upsert slot occupancy with atomic increment + capacity check ─
            {
              Update: {
                TableName: this.slotOccupancyTableName,
                Key: { pk: slotPk },
                UpdateExpression:
                  'SET occupancy = if_not_exists(occupancy, :zero) + :inc, ' +
                  'capacity = if_not_exists(capacity, :cap), ' +
                  'area_id = :areaId, ' +
                  '#d = :date, ' +
                  'start_time = :startTime, ' +
                  'updated_at = :now',
                ConditionExpression: 'attribute_not_exists(pk) OR occupancy < :cap',
                ExpressionAttributeNames: { '#d': 'date' },
                ExpressionAttributeValues: {
                  ':zero': 0,
                  ':inc': 1,
                  ':cap': payload.slotCapacity,
                  ':areaId': payload.areaId,
                  ':date': payload.date,
                  ':startTime': payload.startTime,
                  ':now': now,
                },
              },
            },
            // ── (c) PutItem reservation ─────────────────────────────────────
            {
              Put: {
                TableName: this.tableName,
                Item: reservationItem,
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            // ── (d) UpdateItem member weekly count ───────────────────────────
            {
              Update: {
                TableName: this.membersTableName,
                Key: { PK: memberPk, SK: memberSk },
                UpdateExpression: memberUpdateExpression,
                ExpressionAttributeValues: memberExpressionValues,
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        const reasons = error.CancellationReasons ?? [];
        // Index 0 is the SlotOccupancy ConditionCheck
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          throw new SlotFullException();
        }
      }
      throw this.wrapError(error, 'TransactWrite (create reservation)', this.tableName);
    }

    return new ReservationEntity({
      reservationId: payload.reservationId,
      memberId: payload.memberId,
      areaId: payload.areaId,
      areaName: payload.areaName,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      durationMinutes: payload.durationMinutes,
      status: ReservationStatus.CONFIRMED,
      createdAt: now,
      updatedAt: now,
      expiresAt: payload.expiresAt,
    });
  }

  async cancelWithTransaction(payload: ReservationCancelPayload): Promise<void> {
    this.logger.debug(`cancelWithTransaction: pk=${payload.pk}`);

    const now = new Date().toISOString();
    const slotPk = `SLOT#${payload.areaId}#${payload.date}#${payload.startTime}`;
    const memberPk = `MEMBER#${payload.memberId}`;

    let updateExpression = 'SET #st = :cancelled, cancelled_by_role = :role, updated_at = :now';
    const expressionAttributeValues: Record<string, unknown> = {
      ':cancelled': ReservationStatus.CANCELLED,
      ':role': payload.cancelledByRole,
      ':now': now,
      ':confirmed': ReservationStatus.CONFIRMED,
    };
    const expressionAttributeNames: Record<string, string> = { '#st': 'status' };

    if (payload.cancelReason) {
      updateExpression += ', cancel_reason = :reason';
      expressionAttributeValues[':reason'] = payload.cancelReason;
    }

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            // ── (a) Update reservation status ─────────────────────────────
            {
              Update: {
                TableName: this.tableName,
                Key: { pk: payload.pk, sk: payload.sk },
                UpdateExpression: updateExpression,
                ConditionExpression: '#st = :confirmed',
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
              },
            },
            // ── (b) Decrement slot occupancy ──────────────────────────────
            {
              Update: {
                TableName: this.slotOccupancyTableName,
                Key: { pk: slotPk },
                UpdateExpression: 'ADD occupancy :dec SET updated_at = :now',
                ConditionExpression: 'occupancy > :zero',
                ExpressionAttributeValues: {
                  ':dec': -1,
                  ':zero': 0,
                  ':now': now,
                },
              },
            },
            // ── (c) Decrement member weekly count ─────────────────────────
            {
              Update: {
                TableName: this.membersTableName,
                Key: { PK: memberPk, SK: 'PROFILE' },
                UpdateExpression: 'ADD weekly_reservation_count :dec SET updated_at = :now',
                ConditionExpression: 'weekly_reservation_count > :zero',
                ExpressionAttributeValues: {
                  ':dec': -1,
                  ':zero': 0,
                  ':now': now,
                },
              },
            },
          ],
        }),
      );
    } catch (error) {
      throw this.wrapError(error, 'TransactWrite (cancel reservation)', this.tableName);
    }
  }

  async expireWithTransaction(
    pk: string,
    sk: string,
    areaId: string,
    date: string,
    startTime: string,
  ): Promise<boolean> {
    this.logger.debug(`expireWithTransaction: pk=${pk}`);

    const now = new Date().toISOString();
    const slotPk = `SLOT#${areaId}#${date}#${startTime}`;

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: { pk, sk },
                UpdateExpression: 'SET #st = :expired, updated_at = :now',
                ConditionExpression: '#st = :confirmed',
                ExpressionAttributeNames: { '#st': 'status' },
                ExpressionAttributeValues: {
                  ':expired': ReservationStatus.EXPIRED,
                  ':confirmed': ReservationStatus.CONFIRMED,
                  ':now': now,
                },
              },
            },
            {
              Update: {
                TableName: this.slotOccupancyTableName,
                Key: { pk: slotPk },
                UpdateExpression: 'ADD occupancy :dec SET updated_at = :now',
                ConditionExpression: 'occupancy > :zero',
                ExpressionAttributeValues: {
                  ':dec': -1,
                  ':zero': 0,
                  ':now': now,
                },
              },
            },
          ],
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        const reasons = error.CancellationReasons ?? [];
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          return false; // Already transitioned — idempotent skip
        }
      }
      throw this.wrapError(error, 'TransactWrite (expire reservation)', this.tableName);
    }
  }

  async batchCancelWithTransaction(
    reservations: Array<{
      pk: string;
      sk: string;
      memberId: string;
      areaId: string;
      date: string;
      startTime: string;
    }>,
    reason: string,
  ): Promise<void> {
    this.logger.debug(`batchCancelWithTransaction: count=${reservations.length}`);

    if (reservations.length === 0) return;

    const now = new Date().toISOString();
    // DynamoDB TransactWrite supports up to 100 items.
    // Each reservation requires 3 operations (reservation + slot + member).
    const MAX_PER_BATCH = 30; // 30 * 3 = 90 <= 100

    for (let i = 0; i < reservations.length; i += MAX_PER_BATCH) {
      const batch = reservations.slice(i, i + MAX_PER_BATCH);

      const transactItems = batch.flatMap((r) => {
        const slotPk = `SLOT#${r.areaId}#${r.date}#${r.startTime}`;
        const memberPk = `MEMBER#${r.memberId}`;

        return [
          {
            Update: {
              TableName: this.tableName,
              Key: { pk: r.pk, sk: r.sk },
              UpdateExpression:
                'SET #st = :cancelled, cancelled_by_role = :role, cancel_reason = :reason, updated_at = :now',
              ConditionExpression: '#st = :confirmed',
              ExpressionAttributeNames: { '#st': 'status' },
              ExpressionAttributeValues: {
                ':cancelled': ReservationStatus.CANCELLED,
                ':confirmed': ReservationStatus.CONFIRMED,
                ':role': 'MANAGER',
                ':reason': reason,
                ':now': now,
              },
            },
          },
          {
            Update: {
              TableName: this.slotOccupancyTableName,
              Key: { pk: slotPk },
              UpdateExpression: 'ADD occupancy :dec SET updated_at = :now',
              ConditionExpression: 'occupancy > :zero',
              ExpressionAttributeValues: {
                ':dec': -1,
                ':zero': 0,
                ':now': now,
              },
            },
          },
          {
            Update: {
              TableName: this.membersTableName,
              Key: { PK: memberPk, SK: 'PROFILE' },
              UpdateExpression: 'ADD weekly_reservation_count :dec SET updated_at = :now',
              ConditionExpression: 'weekly_reservation_count > :zero',
              ExpressionAttributeValues: {
                ':dec': -1,
                ':zero': 0,
                ':now': now,
              },
            },
          },
        ];
      });

      try {
        await this.client.send(new TransactWriteCommand({ TransactItems: transactItems }));
      } catch (error) {
        throw this.wrapError(error, 'TransactWrite (batch cancel)', this.tableName);
      }
    }
  }

  private wrapError(error: unknown, operation: string, table: string): Error {
    const original = error instanceof Error ? error : new Error(String(error));
    const wrapped = new Error(`DynamoDB ${operation} on "${table}": ${original.message}`);
    wrapped.name = original.name;
    wrapped.stack = original.stack;
    return wrapped;
  }
}
