import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { ulid } from 'ulid';
import { CreateAreaCommand } from './create-area.command';
import { AREAS_REPOSITORY, AreasRepositoryInterface, AreaRecord } from '../../ports/areas.repository.interface';

@Injectable()
export class CreateAreaHandler {
  private readonly logger = new Logger(CreateAreaHandler.name);

  constructor(
    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  async execute(command: CreateAreaCommand): Promise<AreaRecord> {
    if (!command.name.trim()) {
      throw new BadRequestException('Area name must not be empty.');
    }
    if (command.capacity < 1) {
      throw new BadRequestException('Capacity must be at least 1.');
    }
    if (command.allowedMemberships.length === 0) {
      throw new BadRequestException('At least one membership type must be allowed.');
    }

    const areaId = ulid();
    this.logger.log(`CreateAreaHandler: creating areaId=${areaId} name="${command.name}"`);

    const area: AreaRecord = {
      areaId,
      name: command.name.trim(),
      status: 'Active',
      capacity: command.capacity,
      slotDuration: command.slotDuration,
      openingTime: command.openingTime,
      closingTime: command.closingTime,
      cancelWindowHours: command.cancelWindowHours,
      allowedMemberships: command.allowedMemberships,
      maxDurationMinutes: command.maxDurationMinutes,
      weeklyLimit: command.weeklyLimit,
    };

    return this.areasRepo.save(area);
  }
}
