export type CreateAreaBlockOutcome =
  | { conflict: false; block: BlockData }
  | { conflict: true; affectedReservations: ConflictEntry[]; message: string };

export interface BlockData {
  blockId: string;
  areaId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdAt: string;
}

export interface ConflictEntry {
  reservationId: string;
  memberId: string;
  startTime: string;
  endTime: string;
}
