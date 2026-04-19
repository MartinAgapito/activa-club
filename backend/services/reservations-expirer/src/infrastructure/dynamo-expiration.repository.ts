import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { isExpired } from '../domain/expiration-policy';
import { ExpirationRepository, ExpiredReservation } from '../application/expire-reservations.use-case';

const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE ?? 'ReservationsTable';
const SLOT_OCCUPANCY_TABLE = process.env.SLOT_OCCUPANCY_TABLE ?? 'SlotOccupancyTable';

/**
 * DynamoDB implementation of ExpirationRepository.
 *
 * findConfirmedExpiredReservations: Scans ReservationsTable for all CONFIRMED
 * items and filters in-memory by isExpired(date, endTime). This avoids the
 * need for a composite GSI while keeping the domain logic pure.
 *
 * markAsExpired: UpdateItem with a ConditionExpression ensuring idempotency.
 * releaseSlotOccupancy: UpdateItem decrementing currentOccupancy (floor at 0).
 */
export class DynamoExpirationRepository implements ExpirationRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(client?: DynamoDBDocumentClient) {
    this.client =
      client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' }),
      );
  }

  async findConfirmedExpiredReservations(): Promise<ExpiredReservation[]> {
    const items: ExpiredReservation[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const response = await this.client.send(
        new ScanCommand({
          TableName: RESERVATIONS_TABLE,
          FilterExpression: '#status = :confirmed',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':confirmed': 'CONFIRMED' },
          ExclusiveStartKey: lastKey,
        }),
      );

      const now = new Date();
      for (const item of response.Items ?? []) {
        if (
          typeof item['date'] === 'string' &&
          typeof item['endTime'] === 'string' &&
          isExpired(item['date'] as string, item['endTime'] as string, now)
        ) {
          items.push({
            reservationId: item['reservationId'] as string,
            memberId: item['memberId'] as string,
            areaId: item['areaId'] as string,
            date: item['date'] as string,
            startTime: item['startTime'] as string,
            endTime: item['endTime'] as string,
          });
        }
      }

      lastKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    return items;
  }

  async markAsExpired(
    reservationId: string,
    areaId: string,
    date: string,
    startTime: string,
  ): Promise<void> {
    // pk = "RESERVATION#<reservationId>", sk = "AREA#<areaId>#DATE#<date>#TIME#<startTime>"
    await this.client.send(
      new UpdateCommand({
        TableName: RESERVATIONS_TABLE,
        Key: {
          pk: `RESERVATION#${reservationId}`,
          sk: `AREA#${areaId}#DATE#${date}#TIME#${startTime}`,
        },
        UpdateExpression: 'SET #status = :expired, updatedAt = :now',
        ConditionExpression: '#status = :confirmed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':expired': 'EXPIRED',
          ':confirmed': 'CONFIRMED',
          ':now': new Date().toISOString(),
        },
      }),
    );
  }

  async releaseSlotOccupancy(areaId: string, date: string, startTime: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: SLOT_OCCUPANCY_TABLE,
        Key: {
          pk: `AREA#${areaId}`,
          sk: `DATE#${date}#TIME#${startTime}`,
        },
        UpdateExpression: 'SET currentOccupancy = currentOccupancy - :one',
        ConditionExpression: 'currentOccupancy > :zero',
        ExpressionAttributeValues: {
          ':one': 1,
          ':zero': 0,
        },
      }),
    );
  }
}
