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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { RolesGuard, Roles } from '../guards/roles.guard';
import { ManagerCalendarQueryDto } from '../dtos/manager-calendar-query.dto';
import { CreateAreaBlockDto } from '../dtos/create-area-block.dto';

import { GetManagerCalendarQuery } from '../../application/queries/get-manager-calendar.query';
import { ManagerCancelReservationHandler } from '../../application/commands/manager-cancel-reservation/manager-cancel-reservation.handler';
import { ManagerCancelReservationCommand } from '../../application/commands/manager-cancel-reservation/manager-cancel-reservation.command';
import { CreateAreaBlockHandler } from '../../application/commands/create-area-block/create-area-block.handler';
import { CreateAreaBlockCommand } from '../../application/commands/create-area-block/create-area-block.command';
import { DeleteAreaBlockHandler } from '../../application/commands/delete-area-block/delete-area-block.handler';
import { DeleteAreaBlockCommand } from '../../application/commands/delete-area-block/delete-area-block.command';

/**
 * ManagerController — AC-015
 *
 * Routes (Manager or Admin only):
 *   GET    /v1/manager/reservations                     — daily calendar by area
 *   DELETE /v1/manager/reservations/{reservationId}     — cancel any reservation
 *   POST   /v1/areas/{areaId}/blocks                    — block a time slot
 *   DELETE /v1/areas/{areaId}/blocks/{blockId}          — remove a block
 */
@ApiTags('manager')
@ApiBearerAuth('cognito-jwt')
@UseGuards(RolesGuard)
@Controller()
export class ManagerController {
  private readonly logger = new Logger(ManagerController.name);

  constructor(
    private readonly getManagerCalendarQuery: GetManagerCalendarQuery,
    private readonly managerCancelHandler: ManagerCancelReservationHandler,
    private readonly createAreaBlockHandler: CreateAreaBlockHandler,
    private readonly deleteAreaBlockHandler: DeleteAreaBlockHandler,
  ) {}

  // ─── GET /v1/manager/reservations ────────────────────────────────────────

  @Get('manager/reservations')
  @HttpCode(HttpStatus.OK)
  @Roles('Manager', 'Admin')
  @ApiOperation({ summary: 'Manager daily reservation calendar (AC-015)' })
  @ApiQuery({ name: 'date', required: true, example: '2026-04-10' })
  @ApiQuery({ name: 'areaId', required: false })
  @ApiResponse({ status: 200, description: 'Calendar returned successfully.' })
  @ApiResponse({ status: 400, description: 'INVALID_DATE_FORMAT' })
  async getManagerCalendar(@Query() query: ManagerCalendarQueryDto) {
    this.logger.log(`GET /v1/manager/reservations date=${query.date} areaId=${query.areaId}`);
    return this.getManagerCalendarQuery.execute({ date: query.date, areaId: query.areaId });
  }

  // ─── DELETE /v1/manager/reservations/{reservationId} ─────────────────────

  @Delete('manager/reservations/:reservationId')
  @HttpCode(HttpStatus.OK)
  @Roles('Manager', 'Admin')
  @ApiOperation({ summary: 'Manager cancel any reservation (AC-015)' })
  @ApiParam({ name: 'reservationId', description: 'Reservation ULID' })
  @ApiResponse({ status: 200, description: 'Reservation cancelled by manager.' })
  @ApiResponse({ status: 400, description: 'REASON_REQUIRED' })
  @ApiResponse({ status: 404, description: 'RESERVATION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'INVALID_STATUS' })
  async managerCancelReservation(
    @Param('reservationId') reservationId: string,
    @Body() body: { reason: string },
  ) {
    this.logger.log(`DELETE /v1/manager/reservations/${reservationId}`);
    return this.managerCancelHandler.execute(
      new ManagerCancelReservationCommand(reservationId, body.reason),
    );
  }

  // ─── POST /v1/areas/{areaId}/blocks ──────────────────────────────────────

  @Post('areas/:areaId/blocks')
  @HttpCode(HttpStatus.OK)
  @Roles('Manager', 'Admin')
  @ApiOperation({ summary: 'Block a time slot in an area (AC-015)' })
  @ApiParam({ name: 'areaId', description: 'Area ULID' })
  @ApiResponse({ status: 200, description: 'Block created or conflict warning returned.' })
  @ApiResponse({ status: 400, description: 'INVALID_BLOCK_RANGE' })
  @ApiResponse({ status: 404, description: 'AREA_NOT_FOUND' })
  async createAreaBlock(@Param('areaId') areaId: string, @Body() dto: CreateAreaBlockDto) {
    this.logger.log(`POST /v1/areas/${areaId}/blocks date=${dto.date}`);
    return this.createAreaBlockHandler.execute(
      new CreateAreaBlockCommand(
        areaId,
        dto.date,
        dto.startTime,
        dto.endTime,
        dto.reason,
        dto.confirmForce ?? false,
      ),
    );
  }

  // ─── DELETE /v1/areas/{areaId}/blocks/{blockId} ───────────────────────────

  @Delete('areas/:areaId/blocks/:blockId')
  @HttpCode(HttpStatus.OK)
  @Roles('Manager', 'Admin')
  @ApiOperation({ summary: 'Remove a slot block (AC-015)' })
  @ApiParam({ name: 'areaId', description: 'Area ULID' })
  @ApiParam({ name: 'blockId', description: 'Block ULID' })
  @ApiResponse({ status: 200, description: 'Block removed successfully.' })
  @ApiResponse({ status: 404, description: 'BLOCK_NOT_FOUND' })
  async deleteAreaBlock(@Param('areaId') areaId: string, @Param('blockId') blockId: string) {
    this.logger.log(`DELETE /v1/areas/${areaId}/blocks/${blockId}`);
    return this.deleteAreaBlockHandler.execute(new DeleteAreaBlockCommand(areaId, blockId));
  }
}
