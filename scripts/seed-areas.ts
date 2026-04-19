/**
 * Seed script — populates AreasTable with initial recreational areas for dev.
 *
 * Usage:
 *   AWS_PROFILE=dev AREAS_TABLE_NAME=AreasTable-dev npx ts-node scripts/seed-areas.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'us-east-1' }),
)

const TABLE = process.env.AREAS_TABLE_NAME ?? 'AreasTable-dev'

const areas = [
  {
    pk: 'AREA#pool',
    sk: 'CONFIG',
    area_id: 'pool',
    name: 'Piscina',
    status: 'Active',
    capacity: 10,
    slot_duration: 60,
    opening_time: '08:00',
    closing_time: '20:00',
    cancel_window_hours: 2,
    allowed_memberships: ['VIP', 'Gold', 'Silver'],
    max_duration_minutes: { VIP: 120, Gold: 90, Silver: 60 },
    weekly_limit: { VIP: 7, Gold: 5, Silver: 3 },
  },
  {
    pk: 'AREA#tennis',
    sk: 'CONFIG',
    area_id: 'tennis',
    name: 'Cancha de Tenis',
    status: 'Active',
    capacity: 4,
    slot_duration: 60,
    opening_time: '08:00',
    closing_time: '20:00',
    cancel_window_hours: 2,
    allowed_memberships: ['VIP', 'Gold'],
    max_duration_minutes: { VIP: 120, Gold: 60 },
    weekly_limit: { VIP: 5, Gold: 3 },
  },
  {
    pk: 'AREA#gym',
    sk: 'CONFIG',
    area_id: 'gym',
    name: 'Gimnasio',
    status: 'Active',
    capacity: 20,
    slot_duration: 60,
    opening_time: '07:00',
    closing_time: '22:00',
    cancel_window_hours: 1,
    allowed_memberships: ['VIP', 'Gold', 'Silver'],
    max_duration_minutes: { VIP: 120, Gold: 90, Silver: 60 },
    weekly_limit: { VIP: 7, Gold: 7, Silver: 5 },
  },
  {
    pk: 'AREA#paddle',
    sk: 'CONFIG',
    area_id: 'paddle',
    name: 'Cancha de Paddle',
    status: 'Active',
    capacity: 4,
    slot_duration: 60,
    opening_time: '09:00',
    closing_time: '21:00',
    cancel_window_hours: 2,
    allowed_memberships: ['VIP', 'Gold', 'Silver'],
    max_duration_minutes: { VIP: 120, Gold: 60, Silver: 60 },
    weekly_limit: { VIP: 5, Gold: 4, Silver: 2 },
  },
]

async function seed() {
  console.log(`Seeding ${areas.length} areas into ${TABLE}...`)

  for (const area of areas) {
    await client.send(new PutCommand({ TableName: TABLE, Item: area }))
    console.log(`  ✓ ${area.name} (${area.area_id})`)
  }

  console.log('Done.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
