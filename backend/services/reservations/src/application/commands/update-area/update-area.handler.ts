import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateAreaCommand } from './update-area.command';
import { AREAS_REPOSITORY, AreasRepositoryInterface, AreaRecord } from '../../ports/areas.repository.interface';

@Injectable()
export class UpdateAreaHandler {
  private readonly logger = new Logger(UpdateAreaHandler.name);

  constructor(
    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  async execute(command: UpdateAreaCommand): Promise<AreaRecord> {
    this.logger.log(`UpdateAreaHandler: areaId=${command.areaId}`);

    const existing = await this.areasRepo.findById(command.areaId);
    if (!existing) {
      throw new NotFoundException('AREA_NOT_FOUND');
    }

    if (command.name !== undefined && !command.name.trim()) {
      throw new BadRequestException('Area name must not be empty.');
    }
    if (command.capacity !== undefined && command.capacity < 1) {
      throw new BadRequestException('Capacity must be at least 1.');
    }
    if (command.allowedMemberships !== undefined && command.allowedMemberships.length === 0) {
      throw new BadRequestException('At least one membership type must be allowed.');
    }

    const updated: AreaRecord = {
      areaId: existing.areaId,
      name: command.name?.trim() ?? existing.name,
      status: existing.status,
      capacity: command.capacity ?? existing.capacity,
      slotDuration: command.slotDuration ?? existing.slotDuration,
      openingTime: command.openingTime ?? existing.openingTime,
      closingTime: command.closingTime ?? existing.closingTime,
      cancelWindowHours: command.cancelWindowHours ?? existing.cancelWindowHours,
      allowedMemberships: command.allowedMemberships ?? existing.allowedMemberships,
      maxDurationMinutes: command.maxDurationMinutes ?? existing.maxDurationMinutes,
      weeklyLimit: command.weeklyLimit ?? existing.weeklyLimit,
    };

    return this.areasRepo.save(updated);
  }
}
