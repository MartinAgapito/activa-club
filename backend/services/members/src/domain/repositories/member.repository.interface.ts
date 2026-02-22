import { MemberEntity } from '../entities/member.entity';

/**
 * Member repository port.
 *
 * Defines the persistence contract for MemberEntity. Infrastructure
 * implementations must fulfil this interface. Use cases depend only
 * on this interface — never on concrete repository classes.
 */
export interface MemberRepositoryInterface {
  /**
   * Finds a member by their DNI using GSI_DNI.
   * Returns null when no record is found.
   */
  findByDni(dni: string): Promise<MemberEntity | null>;

  /**
   * Finds a member by their email using GSI_Email.
   * Returns null when no record is found.
   */
  findByEmail(email: string): Promise<MemberEntity | null>;

  /**
   * Persists a new member profile to DynamoDB MembersTable.
   */
  save(member: MemberEntity): Promise<void>;
}

export const MEMBER_REPOSITORY = Symbol('MemberRepositoryInterface');
