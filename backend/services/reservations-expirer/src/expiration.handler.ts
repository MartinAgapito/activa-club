import { ExpireReservationsUseCase } from './application/expire-reservations.use-case';
import { DynamoExpirationRepository } from './infrastructure/dynamo-expiration.repository';

/**
 * AC-016 — Reservation Expiration Lambda Handler.
 *
 * Triggered by EventBridge Scheduler (cron, e.g. every 5 minutes).
 * Scans for CONFIRMED reservations whose slot has ended and marks them as EXPIRED.
 */
export const handler = async (_event: unknown): Promise<void> => {
  const repository = new DynamoExpirationRepository();
  const useCase = new ExpireReservationsUseCase(repository);

  const result = await useCase.execute();

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      processed: result.processed,
      errors: result.errors,
      failedIds: result.failedIds,
    }),
  );
};
