/**
 * CreateReservationCommand — AC-012.
 *
 * Carries the input data for a member reservation request.
 * Plain data object — no business logic.
 */
export class CreateReservationCommand {
  constructor(
    /** Internal memberId (ULID) resolved from Cognito sub. */
    public readonly memberId: string,

    /** Cognito sub — used for logging only, not stored in DynamoDB. */
    public readonly cognitoSub: string,

    /** Membership type from JWT claim (e.g. 'Gold'). */
    public readonly membershipType: string,

    public readonly areaId: string,

    /** YYYY-MM-DD */
    public readonly date: string,

    /** HH:MM 24-hour */
    public readonly startTime: string,

    public readonly durationMinutes: number,
  ) {}
}
