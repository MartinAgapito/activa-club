export class CreateAreaCommand {
  constructor(
    readonly name: string,
    readonly capacity: number,
    readonly slotDuration: number,
    readonly openingTime: string,
    readonly closingTime: string,
    readonly cancelWindowHours: number,
    readonly allowedMemberships: string[],
    readonly maxDurationMinutes: Record<string, number>,
    readonly weeklyLimit: Record<string, number>,
  ) {}
}
