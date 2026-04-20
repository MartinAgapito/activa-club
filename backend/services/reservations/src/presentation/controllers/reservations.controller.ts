import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

// Guards
import { RolesGuard, Roles, extractCognitoPayload } from '../guards/roles.guard';

// DTOs
import { AvailabilityQueryDto } from '../dtos/availability-query.dto';
import { CreateReservationDto } from '../dtos/create-reservation.dto';
import { ListReservationsQueryDto } from '../dtos/list-reservations-query.dto';

// Commands and queries
import { GetAreaAvailabilityQuery } from '../../application/queries/get-area-availability.query';
import { ListMyReservationsQuery } from '../../application/queries/list-my-reservations.query';
import { CreateReservationHandler } from '../../application/commands/create-reservation/create-reservation.handler';
import { CreateReservationCommand } from '../../application/commands/create-reservation/create-reservation.command';
import { CancelReservationHandler } from '../../application/commands/cancel-reservation/cancel-reservation.handler';
import { CancelReservationCommand } from '../../application/commands/cancel-reservation/cancel-reservation.command';
import {
  MembersRepositoryInterface,
  MEMBERS_REPOSITORY,
} from '../../application/ports/members.repository.interface';
import {
  AreasRepositoryInterface,
  AREAS_REPOSITORY,
} from '../../application/ports/areas.repository.interface';
import { Inject } from '@nestjs/common';

/**
 * ReservationsController — AC-011, AC-012, AC-013, AC-014.
 *
 * Routes:
 *   GET  /v1/areas/{areaId}/availability — AC-011 (Member, Manager, Admin)
 *   POST /v1/reservations               — AC-012 (Member only)
 *   DELETE /v1/reservations/{id}        — AC-013 (Member — own reservation)
 *   GET  /v1/reservations/me            — AC-014 (Member only)
 */
@ApiTags('reservations')
@ApiBearerAuth('cognito-jwt')
@UseGuards(RolesGuard)
@Controller()
export class ReservationsController {
  private readonly logger = new Logger(ReservationsController.name);

  constructor(
    private readonly getAreaAvailabilityQuery: GetAreaAvailabilityQuery,
    private readonly listMyReservationsQuery: ListMyReservationsQuery,
    private readonly createReservationHandler: CreateReservationHandler,
    private readonly cancelReservationHandler: CancelReservationHandler,

    @Inject(MEMBERS_REPOSITORY)
    private readonly membersRepo: MembersRepositoryInterface,

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  // ─── GET /v1/areas — list all active areas ───────────────────────────────

  @Get('areas')
  @HttpCode(HttpStatus.OK)
  @Roles('Member', 'Manager', 'Admin')
  @ApiOperation({ summary: 'List all active recreational areas' })
  @ApiResponse({ status: 200, description: 'Active areas returned.' })
  async listAreas() {
    this.logger.log('GET /v1/areas');
    const areas = await this.areasRepo.findAllActive();
    return areas.map((a) => ({
      areaId: a.areaId,
      name: a.name,
      capacity: a.capacity,
      openingTime: a.openingTime,
      closingTime: a.closingTime,
      slotDuration: a.slotDuration,
      allowedMemberships: a.allowedMemberships,
    }));
  }

  // ─── AC-011: GET /v1/areas/{areaId}/availability ─────────────────────────

  @Get('areas/:areaId/availability')
  @HttpCode(HttpStatus.OK)
  @Roles('Member', 'Manager', 'Admin')
  @ApiOperation({
    summary: 'Get area slot availability for a given date (AC-011)',
    description:
      'Returns all time slots for the area with current occupancy and any active blocks. ' +
      'Members also receive their weekly quota information. ' +
      'Requires a valid Cognito JWT token.',
  })
  @ApiParam({ name: 'areaId', description: 'Area ULID', example: '01JFAKE0000000000000000001' })
  @ApiQuery({ name: 'date', description: 'Date in YYYY-MM-DD format', example: '2026-04-10' })
  @ApiResponse({ status: 200, description: 'Availability returned successfully.' })
  @ApiResponse({
    status: 400,
    description: 'INVALID_DATE_FORMAT | DATE_IN_PAST | DATE_EXCEEDS_WINDOW',
  })
  @ApiResponse({ status: 403, description: 'MEMBERSHIP_INACTIVE | AREA_NOT_ACCESSIBLE' })
  @ApiResponse({ status: 404, description: 'AREA_NOT_FOUND' })
  async getAvailability(
    @Param('areaId') areaId: string,
    @Query() query: AvailabilityQueryDto,
    @Req() req: Request,
  ) {
    const payload = extractCognitoPayload(req);
    const callerSub = payload?.sub ?? '';
    const callerRole = (payload?.['cognito:groups'] ?? [])[0] ?? 'Member';
    const membershipType = payload?.['custom:membershipType'] ?? 'Silver';

    // Resolve internal memberId from Cognito sub
    let callerMemberId = payload?.['custom:memberId'] ?? '';
    if (!callerMemberId && callerSub) {
      const member = await this.membersRepo.findByCognitoSub(callerSub);
      callerMemberId = member?.memberId ?? '';
    }

    this.logger.log(`GET /v1/areas/${areaId}/availability?date=${query.date} — role=${callerRole}`);

    return this.getAreaAvailabilityQuery.execute({
      areaId,
      date: query.date,
      callerMemberId,
      callerRole,
      callerMembershipType: membershipType,
    });
  }

  // ─── AC-012: POST /v1/reservations ───────────────────────────────────────

  @Post('reservations')
  @HttpCode(HttpStatus.CREATED)
  @Roles('Member')
  @ApiOperation({
    summary: 'Create a reservation (AC-012)',
    description:
      'Creates a reservation for the authenticated member using a DynamoDB TransactWrite ' +
      'that atomically checks slot capacity and increments the occupancy counter.',
  })
  @ApiCreatedResponse({ description: 'Reservation created successfully.' })
  @ApiResponse({
    status: 400,
    description:
      'DATE_IN_PAST | DATE_EXCEEDS_WINDOW | INVALID_START_TIME | DURATION_EXCEEDS_MAXIMUM | DURATION_NOT_MULTIPLE',
  })
  @ApiResponse({
    status: 403,
    description: 'MEMBERSHIP_INACTIVE | AREA_NOT_ACCESSIBLE | WEEKLY_QUOTA_EXCEEDED',
  })
  @ApiResponse({ status: 404, description: 'AREA_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'SLOT_FULL | OVERLAP_CONFLICT' })
  async createReservation(@Body() dto: CreateReservationDto, @Req() req: Request) {
    const payload = extractCognitoPayload(req);
    const cognitoSub = payload?.sub ?? '';
    const membershipType = payload?.['custom:membershipType'] ?? 'Silver';

    let memberId = payload?.['custom:memberId'] ?? '';
    if (!memberId && cognitoSub) {
      const member = await this.membersRepo.findByCognitoSub(cognitoSub);
      memberId = member?.memberId ?? '';
    }

    this.logger.log(
      `POST /v1/reservations — memberId=${memberId} areaId=${dto.areaId} date=${dto.date}`,
    );

    const command = new CreateReservationCommand(
      memberId,
      cognitoSub,
      membershipType,
      dto.areaId,
      dto.date,
      dto.startTime,
      dto.durationMinutes,
    );

    return this.createReservationHandler.execute(command);
  }

  // ─── AC-014: GET /v1/reservations/me ─────────────────────────────────────

  @Get('reservations/me')
  @HttpCode(HttpStatus.OK)
  @Roles('Member')
  @ApiOperation({
    summary: 'List my reservations with weekly quota (AC-014)',
    description:
      "Returns a paginated list of the authenticated member's reservations filtered by view. " +
      'Also returns the current weekly quota state.',
  })
  @ApiQuery({ name: 'view', enum: ['upcoming', 'history'], required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'lastKey', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Reservation list returned successfully.' })
  @ApiResponse({ status: 403, description: 'MEMBERSHIP_INACTIVE' })
  async listMyReservations(@Query() query: ListReservationsQueryDto, @Req() req: Request) {
    const payload = extractCognitoPayload(req);
    const cognitoSub = payload?.sub ?? '';
    const membershipType = payload?.['custom:membershipType'] ?? 'Silver';

    let memberId = payload?.['custom:memberId'] ?? '';
    if (!memberId && cognitoSub) {
      const member = await this.membersRepo.findByCognitoSub(cognitoSub);
      memberId = member?.memberId ?? '';
    }

    this.logger.log(`GET /v1/reservations/me — memberId=${memberId} view=${query.view}`);

    return this.listMyReservationsQuery.execute({
      memberId,
      membershipType,
      view: query.view ?? 'upcoming',
      limit: query.limit ?? 20,
      lastKey: query.lastKey,
    });
  }

  // ─── AC-013: DELETE /v1/reservations/{reservationId} ─────────────────────

  @Delete('reservations/:reservationId')
  @HttpCode(HttpStatus.OK)
  @Roles('Member')
  @ApiOperation({
    summary: 'Cancel own reservation (AC-013)',
    description:
      'Cancels a CONFIRMED reservation belonging to the authenticated member. ' +
      'Cancellation is only allowed more than 2 hours before the reservation start time.',
  })
  @ApiParam({
    name: 'reservationId',
    description: 'Reservation ULID',
    example: '01JFAKE0000000000000000099',
  })
  @ApiResponse({ status: 200, description: 'Reservation cancelled successfully.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN — reservation belongs to another member' })
  @ApiResponse({ status: 404, description: 'RESERVATION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'CANCELLATION_WINDOW_CLOSED | INVALID_STATUS' })
  async cancelReservation(@Param('reservationId') reservationId: string, @Req() req: Request) {
    const payload = extractCognitoPayload(req);
    const cognitoSub = payload?.sub ?? '';

    let memberId = payload?.['custom:memberId'] ?? '';
    if (!memberId && cognitoSub) {
      const member = await this.membersRepo.findByCognitoSub(cognitoSub);
      memberId = member?.memberId ?? '';
    }

    this.logger.log(`DELETE /v1/reservations/${reservationId} — memberId=${memberId}`);

    const result = await this.cancelReservationHandler.execute(
      new CancelReservationCommand(memberId, reservationId),
    );

    return { reservationId: result.reservationId, message: 'Reserva cancelada correctamente' };
  }
}
