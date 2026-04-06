import { Injectable, Inject, Logger } from '@nestjs/common';
import { DeleteAreaBlockCommand } from './delete-area-block.command';
import {
  AREA_BLOCK_REPOSITORY,
  AreaBlockRepositoryInterface,
} from '../../../domain/repositories/area-block.repository.interface';
import { BlockNotFoundException } from '../../../domain/exceptions/reservation.exceptions';

@Injectable()
export class DeleteAreaBlockHandler {
  private readonly logger = new Logger(DeleteAreaBlockHandler.name);

  constructor(
    @Inject(AREA_BLOCK_REPOSITORY)
    private readonly areaBlockRepo: AreaBlockRepositoryInterface,
  ) {}

  async execute(command: DeleteAreaBlockCommand): Promise<{ blockId: string }> {
    this.logger.log(`DeleteAreaBlockHandler: areaId=${command.areaId} blockId=${command.blockId}`);

    // ── Resolve pk+sk via GSI_BlockId ────────────────────────────────────────
    const keys = await this.areaBlockRepo.findKeysByBlockId(command.blockId);
    if (!keys) {
      throw new BlockNotFoundException();
    }

    // ── Soft-delete (set is_active = false) ──────────────────────────────────
    await this.areaBlockRepo.deactivate(keys.pk, keys.sk);

    this.logger.log(`DeleteAreaBlockHandler: deactivated blockId=${command.blockId}`);

    return { blockId: command.blockId };
  }
}
