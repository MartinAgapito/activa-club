/**
 * DNI value object.
 *
 * Encapsulates validation logic for the Argentine national ID number.
 * Accepts 7–8 alphanumeric characters. Stored as provided (no normalisation).
 */
export class Dni {
  private static readonly PATTERN = /^[0-9A-Za-z]{7,8}$/;

  readonly value: string;

  constructor(raw: string) {
    const trimmed = raw.trim();
    if (!Dni.PATTERN.test(trimmed)) {
      throw new Error(`Invalid DNI format: "${raw}"`);
    }
    this.value = trimmed;
  }

  equals(other: Dni): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
