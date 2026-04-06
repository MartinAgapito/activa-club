import { AreaBlockEntity } from '../entities/area-block.entity';

export const AREA_BLOCK_REPOSITORY = Symbol('AreaBlockRepositoryInterface');

export interface AreaBlockCreatePayload {
  blockId: string;
  areaId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdBy: string;
}

/**
 * Repository interface for AreaBlocksTable.
 */
export interface AreaBlockRepositoryInterface {
  /**
   * Queries GSI_AreaDateBlocks for all active blocks on a given area and date.
   */
  listByAreaAndDate(areaId: string, date: string): Promise<AreaBlockEntity[]>;

  /**
   * Resolves blockId → { pk, sk } using GSI_BlockId.
   */
  findKeysByBlockId(blockId: string): Promise<{ pk: string; sk: string } | null>;

  /** Creates a new area block (PutItem). */
  create(payload: AreaBlockCreatePayload): Promise<AreaBlockEntity>;

  /**
   * Soft-deletes a block by setting is_active = false (UpdateItem).
   */
  deactivate(pk: string, sk: string): Promise<void>;
}
