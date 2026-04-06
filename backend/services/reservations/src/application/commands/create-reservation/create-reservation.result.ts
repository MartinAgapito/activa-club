/**
 * CreateReservationResult — AC-012 success payload.
 */
export class CreateReservationResult {
  constructor(
    public readonly reservationId: string,
    public readonly areaId: string,
    public readonly areaName: string,
    public readonly date: string,
    public readonly startTime: string,
    public readonly endTime: string,
    public readonly durationMinutes: number,
    public readonly status: string,
    public readonly createdAt: string,
  ) {}
}
