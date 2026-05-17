export class ToggleAreaStatusCommand {
  constructor(
    readonly areaId: string,
    readonly status: 'Active' | 'Inactive',
  ) {}
}
