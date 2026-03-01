import { Injectable, Inject, Logger } from '@nestjs/common';
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
 * Register member handler (use case) — AC-001 Rev2.
 *
 * Orchestrates the member registration flow (Step 1):
 *   1. Validate password strength before calling any external service.
 *   2. Look up the DNI in SeedMembersTable (read-only legacy data).
 *   3. Enforce seed-level account_status (reject inactive records).
 *   4. Reject duplicate DNI in MembersTable.
 *   5. Reject duplicate email in MembersTable.
 *   6. Call Cognito SignUp — creates UNCONFIRMED user and sends OTP email.
 *   7. Return HTTP 202 — pending email verification.
 *
 * No DynamoDB profile is persisted at this stage. Profile creation happens
 * in VerifyEmailHandler after the OTP is confirmed (Step 2).
 *
 * This class depends exclusively on domain interfaces — it has no knowledge
 * of DynamoDB internals, Cognito SDK details, or NestJS HTTP concerns.
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

    // Step 4 — Ensure no existing confirmed member with the same DNI
    const existingByDni = await this.memberRepo.findByDni(command.dni);
    if (existingByDni) {
      throw new DniAlreadyRegisteredException();
    }

    // Step 5 — Ensure no existing confirmed member with the same email
    const existingByEmail = await this.memberRepo.findByEmail(command.email);
    if (existingByEmail) {
      throw new EmailAlreadyInUseException();
    }

    // Step 6 — Call Cognito SignUp (creates UNCONFIRMED user, sends OTP email)
    // No rollback needed here — if SignUp fails, no user was created.
    await this.cognitoService.signUp(command.email, command.password, command.dni);

    this.logger.log(
      `RegisterMemberHandler: SignUp accepted for email=${command.email}, awaiting OTP verification`,
    );

    // Step 7 — Return 202 result (profile persisted in VerifyEmailHandler)
    return new RegisterMemberResult(command.email);
  }
}
