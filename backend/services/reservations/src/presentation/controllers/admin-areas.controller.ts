import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
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
  ApiBearerAuth,
} from '@nestjs/swagger';

import { RolesGuard, Roles } from '../guards/roles.guard';
import { CreateAreaDto } from '../dtos/create-area.dto';
import { UpdateAreaDto } from '../dtos/update-area.dto';
import { ToggleAreaStatusDto } from '../dtos/toggle-area-status.dto';

import { CreateAreaHandler } from '../../application/commands/create-area/create-area.handler';
import { CreateAreaCommand } from '../../application/commands/create-area/create-area.command';
import { UpdateAreaHandler } from '../../application/commands/update-area/update-area.handler';
import { UpdateAreaCommand } from '../../application/commands/update-area/update-area.command';
import { ToggleAreaStatusHandler } from '../../application/commands/toggle-area-status/toggle-area-status.handler';
import { ToggleAreaStatusCommand } from '../../application/commands/toggle-area-status/toggle-area-status.command';

import {
  AREAS_REPOSITORY,
  AreasRepositoryInterface,
} from '../../application/ports/areas.repository.interface';
import { Inject } from '@nestjs/common';

/**
 * AdminAreasController — Admin CRUD for recreational areas.
 *
 * Routes (Admin only):
 *   GET   /v1/admin/areas                  — list all areas (including Inactive)
 *   POST  /v1/admin/areas                  — create a new area
 *   PUT   /v1/admin/areas/:areaId          — update area configuration
 *   PATCH /v1/admin/areas/:areaId/status   — activate or deactivate an area
 */
@ApiTags('admin-areas')
@ApiBearerAuth('cognito-jwt')
@UseGuards(RolesGuard)
@Controller('admin/areas')
export class AdminAreasController {
  private readonly logger = new Logger(AdminAreasController.name);

  constructor(
    private readonly createAreaHandler: CreateAreaHandler,
    private readonly updateAreaHandler: UpdateAreaHandler,
    private readonly toggleAreaStatusHandler: ToggleAreaStatusHandler,

    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles('Admin')
  @ApiOperation({ summary: 'List all areas including inactive (Admin only)' })
  @ApiResponse({ status: 200, description: 'All areas returned.' })
  async listAllAreas() {
    this.logger.log('GET /v1/admin/areas');
    return this.areasRepo.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('Admin')
  @ApiOperation({ summary: 'Create a new recreational area (Admin only)' })
  @ApiResponse({ status: 201, description: 'Area created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  async createArea(@Body() dto: CreateAreaDto) {
    this.logger.log(`POST /v1/admin/areas name="${dto.name}"`);
    return this.createAreaHandler.execute(
      new CreateAreaCommand(
        dto.name,
        dto.capacity,
        dto.slotDuration,
        dto.openingTime,
        dto.closingTime,
        dto.cancelWindowHours,
        dto.allowedMemberships,
        dto.maxDurationMinutes,
        dto.weeklyLimit,
      ),
    );
  }

  @Put(':areaId')
  @HttpCode(HttpStatus.OK)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update area configuration (Admin only)' })
  @ApiParam({ name: 'areaId', description: 'Area ID' })
  @ApiResponse({ status: 200, description: 'Area updated.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 404, description: 'AREA_NOT_FOUND' })
  async updateArea(@Param('areaId') areaId: string, @Body() dto: UpdateAreaDto) {
    this.logger.log(`PUT /v1/admin/areas/${areaId}`);
    return this.updateAreaHandler.execute(
      new UpdateAreaCommand(
        areaId,
        dto.name,
        dto.capacity,
        dto.slotDuration,
        dto.openingTime,
        dto.closingTime,
        dto.cancelWindowHours,
        dto.allowedMemberships,
        dto.maxDurationMinutes,
        dto.weeklyLimit,
      ),
    );
  }

  @Patch(':areaId/status')
  @HttpCode(HttpStatus.OK)
  @Roles('Admin')
  @ApiOperation({ summary: 'Activate or deactivate an area (Admin only)' })
  @ApiParam({ name: 'areaId', description: 'Area ID' })
  @ApiResponse({ status: 200, description: 'Status updated.' })
  @ApiResponse({ status: 404, description: 'AREA_NOT_FOUND' })
  async toggleStatus(@Param('areaId') areaId: string, @Body() dto: ToggleAreaStatusDto) {
    this.logger.log(`PATCH /v1/admin/areas/${areaId}/status → ${dto.status}`);
    return this.toggleAreaStatusHandler.execute(new ToggleAreaStatusCommand(areaId, dto.status));
  }
}
