import { Injectable, Inject, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { RegisterMemberCommand } from './register-member.command';
import { RegisterMemberResult } from './register-member.result';
import {
  MemberRepositoryInterface,
  MEMBER_REPOSITORY,
} from '../../../domain/repositories/member.repository.interface';
import {
  SeedMemberRepositoryInterface,
  SEED_MEMBER_REPOSITORY,
} from '../../../domain/repositories/seed-member.repository.interface';
import { CognitoService } from '../../../infrastructure/cognito/cognito.service';
import { MemberEntity } from '../../../domain/entities/member.entity';
import { AccountStatus } from '../../../domain/value-objects/account-status.vo';
import {
  DniNotFoundException,
  AccountInactiveException,
  DniAlreadyRegisteredException,
  EmailAlreadyInUseException,
  PasswordPolicyViolationException,
} from '../../../domain/exceptions/member.exceptions';

/** Cognito password policy — mirrors the User Pool settings. */
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Register member handler (use case).
 *
 * Orchestrates the member registration flow:
 *   1. Validate password strength client-side before calling Cognito.
 *   2. Look up the DNI in SeedMembersTable (read-only legacy data).
 *   3. Enforce seed-level account_status.
 *   4. Reject duplicate DNI or email in MembersTable.
 *   5. Create Cognito user and assign to Member group.
 *   6. Persist member profile in MembersTable.
 *   7. Rollback Cognito user if any downstream step fails.
 *
 * This class depends exclusively on domain interfaces — it has no knowledge
 * of DynamoDB, Cognito SDK, or NestJS HTTP concerns.
 */
@Injectable()
export class RegisterMemberHandler {
  private readonly logger = new Logger(RegisterMemberHandler.name);

  constructor(
    @Inject(SEED_MEMBER_REPOSITORY)
    private readonly seedMemberRepo: SeedMemberRepositoryInterface,

    @Inject(MEMBER_REPOSITORY)
    private readonly memberRepo: MemberRepositoryInterface,

    private readonly cognitoService: CognitoService,
  ) {}

  async execute(command: RegisterMemberCommand): Promise<RegisterMemberResult> {
    // Step 1 — Validate password strength before touching any external service
    if (!PASSWORD_POLICY_REGEX.test(command.password)) {
      throw new PasswordPolicyViolationException(
        'Password must be at least 8 characters and contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character.',
      );
    }

    // Step 2 — Verify DNI exists in the seed (pre-loaded legacy) table
    const seedRecord = await this.seedMemberRepo.findByDni(command.dni);
    if (!seedRecord) {
      throw new DniNotFoundException();
    }

    // Step 3 — Enforce account_status from the seed record
    if (seedRecord.accountStatus === AccountStatus.INACTIVE) {
      throw new AccountInactiveException();
    }

    // Step 4 — Ensure no existing member with the same DNI
    const existingByDni = await this.memberRepo.findByDni(command.dni);
    if (existingByDni) {
      throw new DniAlreadyRegisteredException();
    }

    // Step 5 — Ensure no existing member with the same email
    const existingByEmail = await this.memberRepo.findByEmail(command.email);
    if (existingByEmail) {
      throw new EmailAlreadyInUseException();
    }

    // Step 6 — Create Cognito identity (permanent password, no forced change)
    let cognitoSub: string;
    try {
      cognitoSub = await this.cognitoService.adminCreateUser(command.email, command.password);
      await this.cognitoService.adminSetUserPassword(command.email, command.password);
      await this.cognitoService.adminAddUserToGroup(command.email, 'Member');
    } catch (cognitoError) {
      this.logger.error(
        `Cognito operation failed for ${command.email} — rolling back`,
        cognitoError instanceof Error ? cognitoError.stack : String(cognitoError),
      );
      await this.cognitoService.adminDeleteUser(command.email).catch((rollbackError) => {
        this.logger.error(
          `Rollback (AdminDeleteUser) also failed for ${command.email}`,
          rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
        );
      });
      throw cognitoError;
    }

    // Step 7 — Persist member profile in MembersTable
    const memberId = ulid();
    const now = new Date().toISOString();
    const member = new MemberEntity({
      memberId,
      dni: command.dni,
      fullName: command.fullName ?? seedRecord.fullName,
      email: command.email,
      phone: command.phone ?? seedRecord.phone,
      membershipType: seedRecord.membershipType,
      accountStatus: AccountStatus.ACTIVE,
      cognitoUserId: cognitoSub,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await this.memberRepo.save(member);
    } catch (dbError) {
      this.logger.error(
        `DynamoDB PutItem failed for member ${memberId} — rolling back Cognito user`,
        dbError instanceof Error ? dbError.stack : String(dbError),
      );
      await this.cognitoService.adminDeleteUser(command.email).catch((rollbackError) => {
        this.logger.error(
          `Rollback (AdminDeleteUser) also failed for ${command.email}`,
          rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
        );
      });
      throw dbError;
    }

    this.logger.log(`Member registered successfully: memberId=${memberId}, email=${command.email}`);

    return new RegisterMemberResult(member);
  }
}
