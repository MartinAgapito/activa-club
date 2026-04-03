import { Injectable, Inject, Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { VerifyEmailCommand } from './verify-email.command';
import { VerifyEmailResult } from './verify-email.result';
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
  InvalidCodeException,
  CodeExpiredException,
  TooManyAttemptsException,
  UserNotFoundException,
} from '../../../domain/exceptions/member.exceptions';

/**
 * Verify email handler (use case) — AC-001 Rev2 Step 2.
 *
 * Orchestrates email OTP verification and member profile creation:
 *   1. Call Cognito ConfirmSignUp with the 6-digit OTP.
 *   2. Call Cognito AdminGetUser to read custom:dni and sub.
 *   3. Look up membership_type in SeedMembersTable via DNI.
 *   4. Call Cognito AdminAddUserToGroup("Member").
 *   5. Generate ULID and persist member profile in MembersTable.
 *   6. On DynamoDB failure: rollback by calling AdminDeleteUser, return 500.
 *   7. Return HTTP 201 — account activated.
 *
 * Exception mapping from Cognito SDK names:
 *   - CodeMismatchException          → InvalidCodeException (400)
 *   - ExpiredCodeException           → CodeExpiredException (410)
 *   - TooManyFailedAttemptsException → TooManyAttemptsException (429)
 *   - UserNotFoundException          → UserNotFoundException (404)
 *
 * This class depends exclusively on domain interfaces.
 */
@Injectable()
export class VerifyEmailHandler {
  private readonly logger = new Logger(VerifyEmailHandler.name);

  constructor(
    @Inject(SEED_MEMBER_REPOSITORY)
    private readonly seedMemberRepo: SeedMemberRepositoryInterface,

    @Inject(MEMBER_REPOSITORY)
    private readonly memberRepo: MemberRepositoryInterface,

    private readonly cognitoService: CognitoService,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<VerifyEmailResult> {
    // Step 1 — Confirm the token via Cognito ConfirmSignUp
    try {
      await this.cognitoService.confirmSignUp(command.email, command.token);
    } catch (error) {
      this.mapConfirmSignUpError(error);
      throw error;
    }

    // Step 2 — Retrieve custom:dni and sub from the now-confirmed Cognito user
    const { sub: cognitoSub, dni } = await this.cognitoService.adminGetUser(command.email);

    // Step 3 — Look up membership_type from SeedMembersTable using the DNI
    const seedRecord = await this.seedMemberRepo.findByDni(dni);
    if (!seedRecord) {
      // Should not happen if registration was completed correctly; treat as internal error
      this.logger.error(
        `VerifyEmailHandler: seed record not found for dni=${dni} (email=${command.email}) — rolling back`,
      );
      await this.cognitoService.adminDeleteUser(command.email).catch((rollbackError) => {
        this.logger.error(
          `VerifyEmailHandler: rollback AdminDeleteUser failed for email=${command.email}`,
          rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
        );
      });
      throw new Error(
        `Seed record not found for DNI=${dni} during email verification. Registration rolled back.`,
      );
    }

    // Step 4 — Assign to Member group in Cognito
    try {
      await this.cognitoService.adminAddUserToGroup(command.email, 'Member');
    } catch (groupError) {
      this.logger.error(
        `VerifyEmailHandler: AdminAddUserToGroup failed for email=${command.email} — rolling back`,
        groupError instanceof Error ? groupError.stack : String(groupError),
      );
      await this.cognitoService.adminDeleteUser(command.email).catch((rollbackError) => {
        this.logger.error(
          `VerifyEmailHandler: rollback AdminDeleteUser failed for email=${command.email}`,
          rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
        );
      });
      throw groupError;
    }

    // Step 5 — Generate ULID and persist member profile in MembersTable
    const memberId = ulid();
    const now = new Date().toISOString();

    const member = new MemberEntity({
      memberId,
      dni,
      fullName: seedRecord.fullName,
      email: command.email,
      phone: seedRecord.phone,
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
        `VerifyEmailHandler: DynamoDB PutItem failed for memberId=${memberId} — rolling back Cognito user`,
        dbError instanceof Error ? dbError.stack : String(dbError),
      );
      await this.cognitoService.adminDeleteUser(command.email).catch((rollbackError) => {
        this.logger.error(
          `VerifyEmailHandler: rollback AdminDeleteUser also failed for email=${command.email}`,
          rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
        );
      });
      throw dbError;
    }

    this.logger.log(
      `VerifyEmailHandler: member profile created — memberId=${memberId}, email=${command.email}`,
    );

    return new VerifyEmailResult(member);
  }

  /**
   * Maps Cognito SDK exception names to domain exceptions.
   * Throws the mapped domain exception; falls through for unmapped errors.
   */
  private mapConfirmSignUpError(error: unknown): never | void {
    if (!(error instanceof Error)) return;

    switch (error.name) {
      case 'CodeMismatchException':
        throw new InvalidCodeException();
      case 'ExpiredCodeException':
        throw new CodeExpiredException();
      case 'TooManyFailedAttemptsException':
      case 'TooManyRequestsException':
        throw new TooManyAttemptsException();
      case 'UserNotFoundException':
        throw new UserNotFoundException();
      default:
        // Unknown error — let it propagate as-is for the global filter to handle
        return;
    }
  }
}
