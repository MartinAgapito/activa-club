import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * Singleton DynamoDB Document Client factory.
 *
 * The client is initialised once per Lambda container (cold start) and reused
 * across all warm invocations to avoid repeated connection setup overhead.
 *
 * Configuration is read from environment variables:
 *   DYNAMODB_REGION — AWS region (defaults to us-east-1 for local dev)
 */
let cachedClient: DynamoDBDocumentClient | undefined;

export function createDynamoDBDocumentClient(): DynamoDBDocumentClient {
  if (cachedClient) {
    return cachedClient;
  }

  const region = process.env.DYNAMODB_REGION ?? 'us-east-1';

  const baseClient = new DynamoDBClient({ region });
  cachedClient = DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });

  return cachedClient;
}

/** Token used to inject DynamoDBDocumentClient via NestJS DI. */
export const DYNAMODB_CLIENT = Symbol('DynamoDBDocumentClient');
