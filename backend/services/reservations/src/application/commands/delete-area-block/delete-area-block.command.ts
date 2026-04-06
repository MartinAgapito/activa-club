/**
 * DeleteAreaBlockCommand — AC-015 DELETE /v1/areas/{areaId}/blocks/{blockId}.
 */
export class DeleteAreaBlockCommand {
  constructor(
    public readonly areaId: string,
    public readonly blockId: string,
  ) {}
}
