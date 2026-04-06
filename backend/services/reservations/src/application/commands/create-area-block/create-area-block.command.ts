/**
 * CreateAreaBlockCommand — AC-015 POST /v1/areas/{areaId}/blocks.
 */
export class CreateAreaBlockCommand {
  constructor(
    /** Cognito sub of the manager creating the block. */
    public readonly createdBy: string,
    public readonly areaId: string,
    /** YYYY-MM-DD */
    public readonly date: string,
    /** HH:MM */
    public readonly startTime: string,
    /** HH:MM */
    public readonly endTime: string,
    public readonly reason: string,
    /**
     * When true: if conflicting CONFIRMED reservations exist, cancel them
     * and create the block in a single TransactWrite.
     * When false (default): return HTTP 200 with conflict warning.
     */
    public readonly confirmForce: boolean = false,
  ) {}
}
