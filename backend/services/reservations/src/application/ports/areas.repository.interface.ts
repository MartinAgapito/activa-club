export const AREAS_REPOSITORY = Symbol('AreasRepositoryInterface');

/**
 * Read-only area record used by the reservations service.
 * Maps to the existing AreasTable schema plus EP-02 additions.
 */
export interface AreaRecord {
  areaId: string;
  name: string;
  status: string; // 'Active' | 'Inactive'
  capacity: number;
  slotDuration: number; // minutes
  openingTime: string; // HH:MM
  closingTime: string; // HH:MM
  cancelWindowHours: number;
  allowedMemberships: string[]; // e.g. ['Silver','Gold','VIP']
  maxDurationMinutes: Record<string, number>; // { Silver: 60, Gold: 120, VIP: 240 }
  weeklyLimit: Record<string, number>; // { Silver: 2, Gold: 3, VIP: 5 }
}

/**
 * Port interface for reading and writing area configuration.
 *
 * The application layer uses this port — the infrastructure layer provides
 * a DynamoDB implementation.
 */
export interface AreasRepositoryInterface {
  findById(areaId: string): Promise<AreaRecord | null>;

  /** Returns all areas with status = 'Active'. Used by the manager calendar. */
  findAllActive(): Promise<AreaRecord[]>;

  /** Returns all areas regardless of status. Used by the admin CRUD. */
  findAll(): Promise<AreaRecord[]>;

  /** Upserts an area record. If areaId is provided it must already exist. */
  save(area: AreaRecord): Promise<AreaRecord>;

  /** Updates only the status field of an existing area. */
  updateStatus(areaId: string, status: 'Active' | 'Inactive'): Promise<void>;
}
