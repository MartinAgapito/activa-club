import { RegisterMemberHandler } from '../../application/commands/register-member/register-member.handler';
import { RegisterMemberCommand } from '../../application/commands/register-member/register-member.command';
import { RegisterMemberResult } from '../../application/commands/register-member/register-member.result';
import { MemberRepositoryInterface } from '../../domain/repositories/member.repository.interface';
import {
  SeedMemberRepositoryInterface,
  SeedMemberRecord,
} from '../../domain/repositories/seed-member.repository.interface';
import { CognitoService } from '../../infrastructure/cognito/cognito.service';
import { MemberEntity } from '../../domain/entities/member.entity';
import { MembershipType } from '../../domain/value-objects/membership-type.vo';
import { AccountStatus } from '../../domain/value-objects/account-status.vo';
import {
  DniNotFoundException,
  AccountInactiveException,
  DniAlreadyRegisteredException,
  EmailAlreadyInUseException,
  PasswordPolicyViolationException,
} from '../../domain/exceptions/member.exceptions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSeedMemberRepo: jest.Mocked<SeedMemberRepositoryInterface> = {
  findByDni: jest.fn(),
};

const mockMemberRepo: jest.Mocked<MemberRepositoryInterface> = {
  findByDni: jest.fn(),
  findByEmail: jest.fn(),
  save: jest.fn(),
};

const mockCognitoService = {
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  resendConfirmationCode: jest.fn(),
  adminGetUser: jest.fn(),
  adminAddUserToGroup: jest.fn(),
  adminDeleteUser: jest.fn(),
  adminInitiateAuth: jest.fn(),
  adminRespondToAuthChallenge: jest.fn(),
} as unknown as jest.Mocked<CognitoService>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_COMMAND = new RegisterMemberCommand(
  '20345678',
  'martin.garcia@email.com',
  'SecurePass1!',
);

const ACTIVE_SEED_RECORD: SeedMemberRecord = {
  pk: '20345678',
  dni: '20345678',
  fullName: 'Martin Garcia',
  membershipType: MembershipType.GOLD,
  accountStatus: AccountStatus.ACTIVE,
  importedAt: '2024-01-01T00:00:00.000Z',
};

const INACTIVE_SEED_RECORD: SeedMemberRecord = {
  ...ACTIVE_SEED_RECORD,
  accountStatus: AccountStatus.INACTIVE,
};

const COGNITO_USER_SUB = 'cognito-sub-uuid-1234';

const EXISTING_MEMBER = new MemberEntity({
  memberId: '01EXISTING',
  dni: '20345678',
  fullName: 'Martin Garcia',
  email: 'martin.garcia@email.com',
  membershipType: MembershipType.GOLD,
  accountStatus: AccountStatus.ACTIVE,
  cognitoUserId: COGNITO_USER_SUB,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegisterMemberHandler (AC-001 Rev2 — SignUp flow)', () => {
  let handler: RegisterMemberHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new RegisterMemberHandler(mockSeedMemberRepo, mockMemberRepo, mockCognitoService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('returns a RegisterMemberResult containing the email on success', async () => {
      // Arrange
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.signUp.mockResolvedValue(COGNITO_USER_SUB);

      // Act
      const result = await handler.execute(VALID_COMMAND);

      // Assert
      expect(result).toBeInstanceOf(RegisterMemberResult);
      expect(result.email).toBe(VALID_COMMAND.email);
    });

    it('calls Cognito signUp with correct arguments (email, password, dni)', async () => {
      // Arrange
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.signUp.mockResolvedValue(COGNITO_USER_SUB);

      // Act
      await handler.execute(VALID_COMMAND);

      // Assert
      expect(mockCognitoService.signUp).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.signUp).toHaveBeenCalledWith(
        VALID_COMMAND.email,
        VALID_COMMAND.password,
        VALID_COMMAND.dni,
      );
    });

    it('does NOT persist a member profile to DynamoDB during registration', async () => {
      // Arrange — profile creation happens in VerifyEmailHandler, not here
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.signUp.mockResolvedValue(COGNITO_USER_SUB);

      // Act
      await handler.execute(VALID_COMMAND);

      // Assert — memberRepo.save must NOT be called in Step 1
      expect(mockMemberRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── Password policy violation ───────────────────────────────────────────────

  describe('execute — password policy violation', () => {
    it('throws PasswordPolicyViolationException for a weak password before any external call', async () => {
      const weakCommand = new RegisterMemberCommand(
        '20345678',
        'test@email.com',
        'weakpassword', // no uppercase, no digit, no special char
      );

      await expect(handler.execute(weakCommand)).rejects.toThrow(PasswordPolicyViolationException);

      // Password check is first — no external calls should be made
      expect(mockSeedMemberRepo.findByDni).not.toHaveBeenCalled();
      expect(mockMemberRepo.findByDni).not.toHaveBeenCalled();
      expect(mockCognitoService.signUp).not.toHaveBeenCalled();
    });

    it('throws PasswordPolicyViolationException for password missing a special character', async () => {
      const weakCommand = new RegisterMemberCommand(
        '20345678',
        'test@email.com',
        'Password1', // no special character
      );

      await expect(handler.execute(weakCommand)).rejects.toThrow(PasswordPolicyViolationException);
    });

    it('throws PasswordPolicyViolationException for password missing a digit', async () => {
      const weakCommand = new RegisterMemberCommand(
        '20345678',
        'test@email.com',
        'Password!', // no digit
      );

      await expect(handler.execute(weakCommand)).rejects.toThrow(PasswordPolicyViolationException);
    });

    it('accepts a password that meets all policy rules', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.signUp.mockResolvedValue(COGNITO_USER_SUB);

      const strongCommand = new RegisterMemberCommand('20345678', 'test@email.com', 'StrongPass1!');

      await expect(handler.execute(strongCommand)).resolves.toBeInstanceOf(RegisterMemberResult);
    });
  });

  // ── DNI not found ───────────────────────────────────────────────────────────

  describe('execute — DNI not found', () => {
    it('throws DniNotFoundException when seed record does not exist', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(null);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(DniNotFoundException);
    });

    it('does not query MembersTable when seed lookup fails', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(null);

      await handler.execute(VALID_COMMAND).catch(() => {});

      expect(mockMemberRepo.findByDni).not.toHaveBeenCalled();
      expect(mockMemberRepo.findByEmail).not.toHaveBeenCalled();
      expect(mockCognitoService.signUp).not.toHaveBeenCalled();
    });
  });

  // ── Account inactive ────────────────────────────────────────────────────────

  describe('execute — account inactive', () => {
    it('throws AccountInactiveException when seed account_status is inactive', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(INACTIVE_SEED_RECORD);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(AccountInactiveException);
    });

    it('does not call Cognito signUp when account is inactive', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(INACTIVE_SEED_RECORD);

      await handler.execute(VALID_COMMAND).catch(() => {});

      expect(mockCognitoService.signUp).not.toHaveBeenCalled();
    });
  });

  // ── DNI already registered ──────────────────────────────────────────────────

  describe('execute — DNI already registered', () => {
    it('throws DniAlreadyRegisteredException when member with same DNI exists', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(EXISTING_MEMBER);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(DniAlreadyRegisteredException);
    });

    it('does not check email or call Cognito when DNI is already registered', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(EXISTING_MEMBER);

      await handler.execute(VALID_COMMAND).catch(() => {});

      expect(mockMemberRepo.findByEmail).not.toHaveBeenCalled();
      expect(mockCognitoService.signUp).not.toHaveBeenCalled();
    });
  });

  // ── Email already in use ────────────────────────────────────────────────────

  describe('execute — email already in use', () => {
    it('throws EmailAlreadyInUseException when member with same email exists', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(EXISTING_MEMBER);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(EmailAlreadyInUseException);
    });

    it('does not call Cognito signUp when email is already in use', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(EXISTING_MEMBER);

      await handler.execute(VALID_COMMAND).catch(() => {});

      expect(mockCognitoService.signUp).not.toHaveBeenCalled();
    });
  });

  // ── Cognito signUp failure ──────────────────────────────────────────────────

  describe('execute — Cognito signUp failure', () => {
    it('propagates Cognito errors when signUp fails', async () => {
      const cognitoError = new Error('Cognito service unavailable');
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.signUp.mockRejectedValue(cognitoError);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(cognitoError);
    });

    it('does NOT call adminDeleteUser on signUp failure (no user was created yet)', async () => {
      const cognitoError = new Error('SignUp failed');
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.signUp.mockRejectedValue(cognitoError);

      await handler.execute(VALID_COMMAND).catch(() => {});

      // No rollback needed — SignUp is atomic; if it fails, no user exists
      expect(mockCognitoService.adminDeleteUser).not.toHaveBeenCalled();
    });
  });

  // ── Execution order ─────────────────────────────────────────────────────────

  describe('execute — call order', () => {
    it('validates password before querying any external service', async () => {
      const callOrder: string[] = [];

      mockSeedMemberRepo.findByDni.mockImplementation(async () => {
        callOrder.push('seedQuery');
        return ACTIVE_SEED_RECORD;
      });
      mockMemberRepo.findByDni.mockImplementation(async () => {
        callOrder.push('memberDniQuery');
        return null;
      });
      mockMemberRepo.findByEmail.mockImplementation(async () => {
        callOrder.push('memberEmailQuery');
        return null;
      });
      mockCognitoService.signUp.mockImplementation(async () => {
        callOrder.push('cognitoSignUp');
        return COGNITO_USER_SUB;
      });

      await handler.execute(VALID_COMMAND);

      expect(callOrder).toEqual([
        'seedQuery',
        'memberDniQuery',
        'memberEmailQuery',
        'cognitoSignUp',
      ]);
    });
  });
});
