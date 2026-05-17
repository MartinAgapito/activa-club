import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { ToggleAreaStatusCommand } from './toggle-area-status.command';
import { AREAS_REPOSITORY, AreasRepositoryInterface } from '../../ports/areas.repository.interface';

@Injectable()
export class ToggleAreaStatusHandler {
  private readonly logger = new Logger(ToggleAreaStatusHandler.name);

  constructor(
    @Inject(AREAS_REPOSITORY)
    private readonly areasRepo: AreasRepositoryInterface,
  ) {}

  async execute(command: ToggleAreaStatusCommand): Promise<{ areaId: string; status: string }> {
    this.logger.log(`ToggleAreaStatusHandler: areaId=${command.areaId} → ${command.status}`);

    const existing = await this.areasRepo.findById(command.areaId);
    if (!existing) {
      throw new NotFoundException('AREA_NOT_FOUND');
    }

    await this.areasRepo.updateStatus(command.areaId, command.status);

    return { areaId: command.areaId, status: command.status };
  }
}
