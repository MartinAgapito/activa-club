import { RegisterMemberHandler } from '../../application/commands/register-member/register-member.handler';
import { RegisterMemberCommand } from '../../application/commands/register-member/register-member.command';
import { RegisterMemberResult } from '../../application/commands/register-member/register-member.result';
import { MemberRepositoryInterface } from '../../domain/repositories/member.repository.interface';
import { SeedMemberRepositoryInterface, SeedMemberRecord } from '../../domain/repositories/seed-member.repository.interface';
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
  adminCreateUser: jest.fn(),
  adminSetUserPassword: jest.fn(),
  adminAddUserToGroup: jest.fn(),
  adminDeleteUser: jest.fn(),
} as unknown as jest.Mocked<CognitoService>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_COMMAND = new RegisterMemberCommand(
  '20345678',
  'martin.garcia@email.com',
  'SecurePass1!',
  'Martin Garcia',
  '+5491112345678',
);

const ACTIVE_SEED_RECORD: SeedMemberRecord = {
  pk: 'DNI#20345678',
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

const COGNITO_SUB = 'cognito-sub-uuid-1234';

const EXISTING_MEMBER = new MemberEntity({
  memberId: '01EXISTING',
  dni: '20345678',
  fullName: 'Martin Garcia',
  email: 'martin.garcia@email.com',
  membershipType: MembershipType.GOLD,
  accountStatus: AccountStatus.ACTIVE,
  cognitoUserId: COGNITO_SUB,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegisterMemberHandler', () => {
  let handler: RegisterMemberHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    handler = new RegisterMemberHandler(
      mockSeedMemberRepo,
      mockMemberRepo,
      mockCognitoService,
    );
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('returns a RegisterMemberResult with the correct data', async () => {
      // Arrange
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockResolvedValue(COGNITO_SUB);
      mockCognitoService.adminSetUserPassword.mockResolvedValue(undefined);
      mockCognitoService.adminAddUserToGroup.mockResolvedValue(undefined);
      mockMemberRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(VALID_COMMAND);

      // Assert
      expect(result).toBeInstanceOf(RegisterMemberResult);
      expect(result.email).toBe(VALID_COMMAND.email);
      expect(result.fullName).toBe(VALID_COMMAND.fullName);
      expect(result.membershipType).toBe(MembershipType.GOLD);
      expect(result.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(result.memberId).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('falls back to seed fullName when command fullName is not provided', async () => {
      // Arrange
      const commandWithoutName = new RegisterMemberCommand(
        '20345678',
        'martin.garcia@email.com',
        'SecurePass1!',
        undefined,
      );
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockResolvedValue(COGNITO_SUB);
      mockCognitoService.adminSetUserPassword.mockResolvedValue(undefined);
      mockCognitoService.adminAddUserToGroup.mockResolvedValue(undefined);
      mockMemberRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(commandWithoutName);

      // Assert
      expect(result.fullName).toBe(ACTIVE_SEED_RECORD.fullName);
    });

    it('calls Cognito operations in order', async () => {
      // Arrange
      const callOrder: string[] = [];
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockImplementation(async () => {
        callOrder.push('adminCreateUser');
        return COGNITO_SUB;
      });
      mockCognitoService.adminSetUserPassword.mockImplementation(async () => {
        callOrder.push('adminSetUserPassword');
      });
      mockCognitoService.adminAddUserToGroup.mockImplementation(async () => {
        callOrder.push('adminAddUserToGroup');
      });
      mockMemberRepo.save.mockResolvedValue(undefined);

      // Act
      await handler.execute(VALID_COMMAND);

      // Assert
      expect(callOrder).toEqual(['adminCreateUser', 'adminSetUserPassword', 'adminAddUserToGroup']);
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
    });
  });

  // ── Account inactive ────────────────────────────────────────────────────────

  describe('execute — account inactive', () => {
    it('throws AccountInactiveException when seed account_status is inactive', async () => {
      mockSeedMemberRepo.findByDni.mockResolvedValue(INACTIVE_SEED_RECORD);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(AccountInactiveException);
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
      expect(mockCognitoService.adminCreateUser).not.toHaveBeenCalled();
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
  });

  // ── Password policy violation ───────────────────────────────────────────────

  describe('execute — password policy violation', () => {
    it('throws PasswordPolicyViolationException for a weak password (before calling seed)', async () => {
      const weakCommand = new RegisterMemberCommand(
        '20345678',
        'test@email.com',
        'weakpassword',   // no uppercase, no digit, no symbol
      );

      await expect(handler.execute(weakCommand)).rejects.toThrow(PasswordPolicyViolationException);
      // Seed should not be called — password check is first
      expect(mockSeedMemberRepo.findByDni).not.toHaveBeenCalled();
    });

    it('throws PasswordPolicyViolationException for password missing special char', async () => {
      const weakCommand = new RegisterMemberCommand(
        '20345678',
        'test@email.com',
        'Password1',   // no special character
      );

      await expect(handler.execute(weakCommand)).rejects.toThrow(PasswordPolicyViolationException);
    });
  });

  // ── Cognito failure + rollback ──────────────────────────────────────────────

  describe('execute — Cognito failure with rollback', () => {
    it('calls adminDeleteUser and re-throws when adminCreateUser fails', async () => {
      const cognitoError = new Error('Cognito service unavailable');
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockRejectedValue(cognitoError);
      mockCognitoService.adminDeleteUser.mockResolvedValue(undefined);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(cognitoError);
      expect(mockCognitoService.adminDeleteUser).toHaveBeenCalledWith(VALID_COMMAND.email);
    });

    it('calls adminDeleteUser and re-throws when adminAddUserToGroup fails', async () => {
      const groupError = new Error('Group assignment failed');
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockResolvedValue(COGNITO_SUB);
      mockCognitoService.adminSetUserPassword.mockResolvedValue(undefined);
      mockCognitoService.adminAddUserToGroup.mockRejectedValue(groupError);
      mockCognitoService.adminDeleteUser.mockResolvedValue(undefined);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(groupError);
      expect(mockCognitoService.adminDeleteUser).toHaveBeenCalledWith(VALID_COMMAND.email);
    });

    it('still re-throws the original error even if rollback adminDeleteUser also fails', async () => {
      const cognitoError = new Error('Cognito service unavailable');
      const rollbackError = new Error('Rollback also failed');
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockRejectedValue(cognitoError);
      mockCognitoService.adminDeleteUser.mockRejectedValue(rollbackError);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(cognitoError);
    });
  });

  // ── DynamoDB PutItem failure + rollback ────────────────────────────────────

  describe('execute — DynamoDB PutItem failure with rollback', () => {
    it('calls adminDeleteUser and re-throws when memberRepo.save fails', async () => {
      const dbError = new Error('DynamoDB write failed');
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockResolvedValue(COGNITO_SUB);
      mockCognitoService.adminSetUserPassword.mockResolvedValue(undefined);
      mockCognitoService.adminAddUserToGroup.mockResolvedValue(undefined);
      mockMemberRepo.save.mockRejectedValue(dbError);
      mockCognitoService.adminDeleteUser.mockResolvedValue(undefined);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(dbError);
      expect(mockCognitoService.adminDeleteUser).toHaveBeenCalledWith(VALID_COMMAND.email);
    });

    it('does not double-call adminDeleteUser if PutItem fails (only one rollback)', async () => {
      const dbError = new Error('DynamoDB write failed');
      mockSeedMemberRepo.findByDni.mockResolvedValue(ACTIVE_SEED_RECORD);
      mockMemberRepo.findByDni.mockResolvedValue(null);
      mockMemberRepo.findByEmail.mockResolvedValue(null);
      mockCognitoService.adminCreateUser.mockResolvedValue(COGNITO_SUB);
      mockCognitoService.adminSetUserPassword.mockResolvedValue(undefined);
      mockCognitoService.adminAddUserToGroup.mockResolvedValue(undefined);
      mockMemberRepo.save.mockRejectedValue(dbError);
      mockCognitoService.adminDeleteUser.mockResolvedValue(undefined);

      await handler.execute(VALID_COMMAND).catch(() => {});

      expect(mockCognitoService.adminDeleteUser).toHaveBeenCalledTimes(1);
    });
  });
});
