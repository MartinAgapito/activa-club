import { Module } from '@nestjs/common';
import { MembersModule } from '../services/members/members.module';

/**
 * Root application module.
 *
 * Business modules are registered here as the project grows.
 * Each service (members, reservations, etc.) has its own NestJS module
 * that is imported here when deployed as a single Lambda, or used
 * independently when deployed as separate Lambda functions.
 *
 * Shared concerns (auth, logging, DynamoDB) are provided via shared libs
 * under /libs and imported by the individual feature modules.
 */
@Module({
  imports: [
    MembersModule,
    // Additional feature modules will be registered here as stories are implemented.
    // Example: ReservationsModule, PaymentsModule, etc.
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
