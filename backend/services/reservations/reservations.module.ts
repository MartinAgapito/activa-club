import { Module } from '@nestjs/common';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Controllers
import { ReservationsController } from './src/presentation/controllers/reservations.controller';
import { ManagerController } from './src/presentation/controllers/manager.controller';

// Application — commands
import { CreateReservationHandler } from './src/application/commands/create-reservation/create-reservation.handler';
import { CancelReservationHandler } from './src/application/commands/cancel-reservation/cancel-reservation.handler';
import { ManagerCancelReservationHandler } from './src/application/commands/manager-cancel-reservation/manager-cancel-reservation.handler';
import { CreateAreaBlockHandler } from './src/application/commands/create-area-block/create-area-block.handler';
import { DeleteAreaBlockHandler } from './src/application/commands/delete-area-block/delete-area-block.handler';

// Application — queries
import { GetAreaAvailabilityQuery } from './src/application/queries/get-area-availability.query';
import { ListMyReservationsQuery } from './src/application/queries/list-my-reservations.query';
import { GetManagerCalendarQuery } from './src/application/queries/get-manager-calendar.query';

// Infrastructure — repositories
import { ReservationDynamoRepository } from './src/infrastructure/repositories/reservation.dynamo.repository';
import { SlotOccupancyDynamoRepository } from './src/infrastructure/repositories/slot-occupancy.dynamo.repository';
import { AreaBlockDynamoRepository } from './src/infrastructure/repositories/area-block.dynamo.repository';
import { AreasDynamoRepository } from './src/infrastructure/repositories/areas.dynamo.repository';
import { MembersDynamoRepository } from './src/infrastructure/repositories/members.dynamo.repository';

// Infrastructure — DynamoDB client
import {
  DYNAMODB_CLIENT,
  createDynamoDBDocumentClient,
} from './src/infrastructure/dynamo-client.factory';

// Domain tokens
import { RESERVATION_REPOSITORY } from './src/domain/repositories/reservation.repository.interface';
import { SLOT_OCCUPANCY_REPOSITORY } from './src/domain/repositories/slot-occupancy.repository.interface';
import { AREA_BLOCK_REPOSITORY } from './src/domain/repositories/area-block.repository.interface';
import { AREAS_REPOSITORY } from './src/application/ports/areas.repository.interface';
import { MEMBERS_REPOSITORY } from './src/application/ports/members.repository.interface';

@Module({
  controllers: [ReservationsController, ManagerController],
  providers: [
    // ── DynamoDB client singleton ──────────────────────────────────────────
    {
      provide: DYNAMODB_CLIENT,
      useFactory: (): DynamoDBDocumentClient => createDynamoDBDocumentClient(),
    },

    // ── Repository bindings ────────────────────────────────────────────────
    {
      provide: RESERVATION_REPOSITORY,
      useFactory: (client: DynamoDBDocumentClient) => new ReservationDynamoRepository(client),
      inject: [DYNAMODB_CLIENT],
    },
    {
      provide: SLOT_OCCUPANCY_REPOSITORY,
      useFactory: (client: DynamoDBDocumentClient) => new SlotOccupancyDynamoRepository(client),
      inject: [DYNAMODB_CLIENT],
    },
    {
      provide: AREA_BLOCK_REPOSITORY,
      useFactory: (client: DynamoDBDocumentClient) => new AreaBlockDynamoRepository(client),
      inject: [DYNAMODB_CLIENT],
    },
    {
      provide: AREAS_REPOSITORY,
      useFactory: (client: DynamoDBDocumentClient) => new AreasDynamoRepository(client),
      inject: [DYNAMODB_CLIENT],
    },
    {
      provide: MEMBERS_REPOSITORY,
      useFactory: (client: DynamoDBDocumentClient) => new MembersDynamoRepository(client),
      inject: [DYNAMODB_CLIENT],
    },

    // ── Use case handlers — AC-012 ─────────────────────────────────────────
    CreateReservationHandler,

    // ── Use case handlers — AC-013 ─────────────────────────────────────────
    CancelReservationHandler,

    // ── Use case handlers — AC-015 ─────────────────────────────────────────
    ManagerCancelReservationHandler,
    CreateAreaBlockHandler,
    DeleteAreaBlockHandler,

    // ── Queries — AC-011, AC-014, AC-015 ──────────────────────────────────
    GetAreaAvailabilityQuery,
    ListMyReservationsQuery,
    GetManagerCalendarQuery,
  ],
})
export class ReservationsModule {}
