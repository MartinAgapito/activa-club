import { DeleteAreaBlockHandler } from '../../application/commands/delete-area-block/delete-area-block.handler';
import { DeleteAreaBlockCommand } from '../../application/commands/delete-area-block/delete-area-block.command';
import { AreaBlockRepositoryInterface } from '../../domain/repositories/area-block.repository.interface';
import { BlockNotFoundException } from '../../domain/exceptions/reservation.exceptions';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_KEYS = { pk: 'AREA#area-01#DATE#2026-05-01', sk: 'BLOCK#block-01' };

function makeBlockRepo(
  overrides: Partial<AreaBlockRepositoryInterface> = {},
): jest.Mocked<AreaBlockRepositoryInterface> {
  return {
    listByAreaAndDate: jest.fn(),
    findKeysByBlockId: jest.fn().mockResolvedValue(MOCK_KEYS),
    create: jest.fn(),
    deactivate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<AreaBlockRepositoryInterface>;
}

function makeHandler(overrides: Partial<AreaBlockRepositoryInterface> = {}): DeleteAreaBlockHandler {
  return new DeleteAreaBlockHandler(makeBlockRepo(overrides));
}

const VALID_COMMAND = new DeleteAreaBlockCommand('area-01', 'block-01');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DeleteAreaBlockHandler — AC-015', () => {
  describe('Caso 1: bloque existe → eliminado exitosamente', () => {
    it('returns the blockId on successful deactivation', async () => {
      const handler = makeHandler();
      const result = await handler.execute(VALID_COMMAND);
      expect(result.blockId).toBe('block-01');
    });

    it('calls findKeysByBlockId with the correct blockId', async () => {
      const blockRepo = makeBlockRepo();
      const handler = new DeleteAreaBlockHandler(blockRepo);

      await handler.execute(VALID_COMMAND);

      expect(blockRepo.findKeysByBlockId).toHaveBeenCalledWith('block-01');
    });

    it('calls deactivate with the pk and sk resolved from GSI lookup', async () => {
      const blockRepo = makeBlockRepo();
      const handler = new DeleteAreaBlockHandler(blockRepo);

      await handler.execute(VALID_COMMAND);

      expect(blockRepo.deactivate).toHaveBeenCalledTimes(1);
      expect(blockRepo.deactivate).toHaveBeenCalledWith(MOCK_KEYS.pk, MOCK_KEYS.sk);
    });

    it('calls findKeysByBlockId exactly once', async () => {
      const blockRepo = makeBlockRepo();
      const handler = new DeleteAreaBlockHandler(blockRepo);

      await handler.execute(VALID_COMMAND);

      expect(blockRepo.findKeysByBlockId).toHaveBeenCalledTimes(1);
    });
  });

  describe('Caso 2: bloque no existe → lanza BLOCK_NOT_FOUND', () => {
    it('throws BlockNotFoundException when GSI lookup returns null', async () => {
      const handler = makeHandler({ findKeysByBlockId: jest.fn().mockResolvedValue(null) });

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(BlockNotFoundException);
    });

    it('does not call deactivate when block is not found', async () => {
      const blockRepo = makeBlockRepo({ findKeysByBlockId: jest.fn().mockResolvedValue(null) });
      const handler = new DeleteAreaBlockHandler(blockRepo);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(BlockNotFoundException);

      expect(blockRepo.deactivate).not.toHaveBeenCalled();
    });

    it('throws BlockNotFoundException with the correct error code', async () => {
      const handler = makeHandler({ findKeysByBlockId: jest.fn().mockResolvedValue(null) });

      try {
        await handler.execute(VALID_COMMAND);
        fail('Expected BlockNotFoundException to be thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BlockNotFoundException);
        expect(err.code).toBe('BLOCK_NOT_FOUND');
      }
    });
  });
});
