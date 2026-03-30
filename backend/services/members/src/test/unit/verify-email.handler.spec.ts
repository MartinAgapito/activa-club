import { VerifyEmailHandler } from '../../application/commands/verify-email/verify-email.handler';
import { VerifyEmailCommand } from '../../application/commands/verify-email/verify-email.command';
import { VerifyEmailResult } from '../../application/commands/verify-email/verify-email.result';
import { MemberRepositoryInterface } from '../../domain/repositories/member.repository.interface';
import {
  SeedMemberRepositoryInterface,
  SeedMemberRecord,
} from '../../domain/repositories/seed-member.repository.interface';
import { CognitoService } from '../../infrastructure/cognito/cognito.service';
import { MembershipType } from '../../domain/value-objects/membership-type.vo';
import { AccountStatus } from '../../domain/value-objects/account-status.vo';
import {
  InvalidCodeException,
  CodeExpiredException,
  TooManyAttemptsException,
  UserNotFoundException,
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

const VALID_COMMAND = new VerifyEmailCommand('martin.garcia@email.com', '482917');

const COGNITO_USER = { sub: 'cognito-sub-uuid-1234', dni: '20345678' };

const SEED_RECORD: SeedMemberRecord = {
  pk: '20345678',
  dni: '20345678',
  fullName: 'Martin Garcia',
  membershipType: MembershipType.GOLD,
  accountStatus: AccountStatus.ACTIVE,
  importedAt: '2024-01-01T00:00:00.000Z',
};

// ─── Helper: create a Cognito error with a given name ────────────────────────

function cognitoError(name: string, message?: string): Error {
  const error = new Error(message ?? name);
  error.name = name;
  return error;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VerifyEmailHandler (AC-001 Rev2 — Step 2)', () => {
  let handler: VerifyEmailHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new VerifyEmailHandler(mockSeedMemberRepo, mockMemberRepo, mockCognitoService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    beforeEach(() => {
      mockCognitoService.confirmSignUp.mockResolvedValue(undefined);
      mockCognitoService.adminGetUser.mockResolvedValue(COGNITO_USER);
      mockSeedMemberRepo.findByDni.mockResolvedValue(SEED_RECORD);
      mockCognitoService.adminAddUserToGroup.mockResolvedValue(undefined);
      mockMemberRepo.save.mockResolvedValue(undefined);
    });

    it('returns a VerifyEmailResult with the correct data', async () => {
      const result = await handler.execute(VALID_COMMAND);

      expect(result).toBeInstanceOf(VerifyEmailResult);
      expect(result.email).toBe(VALID_COMMAND.email);
      expect(result.fullName).toBe(SEED_RECORD.fullName);
      expect(result.membershipType).toBe(MembershipType.GOLD);
      expect(result.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(result.memberId).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('calls confirmSignUp, adminGetUser, findByDni, adminAddUserToGroup, and save in order', async () => {
      const callOrder: string[] = [];

      mockCognitoService.confirmSignUp.mockImplementation(async () => {
        callOrder.push('confirmSignUp');
      });
      mockCognitoService.adminGetUser.mockImplementation(async () => {
        callOrder.push('adminGetUser');
        return COGNITO_USER;
      });
      mockSeedMemberRepo.findByDni.mockImplementation(async () => {
        callOrder.push('seedFindByDni');
        return SEED_RECORD;
      });
      mockCognitoService.adminAddUserToGroup.mockImplementation(async () => {
        callOrder.push('adminAddUserToGroup');
      });
      mockMemberRepo.save.mockImplementation(async () => {
        callOrder.push('save');
      });

      await handler.execute(VALID_COMMAND);

      expect(callOrder).toEqual([
        'confirmSignUp',
        'adminGetUser',
        'seedFindByDni',
        'adminAddUserToGroup',
        'save',
      ]);
    });

    it('adds the user to the "Member" group', async () => {
      await handler.execute(VALID_COMMAND);

      expect(mockCognitoService.adminAddUserToGroup).toHaveBeenCalledWith(
        VALID_COMMAND.email,
        'Member',
      );
    });

    it('persists the member with account_status=active', async () => {
      await handler.execute(VALID_COMMAND);

      const savedMember = mockMemberRepo.save.mock.calls[0][0];
      expect(savedMember.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(savedMember.cognitoUserId).toBe(COGNITO_USER.sub);
      expect(savedMember.dni).toBe(COGNITO_USER.dni);
    });
  });

  // ── ConfirmSignUp errors ────────────────────────────────────────────────────

  describe('execute — ConfirmSignUp Cognito errors', () => {
    it('throws InvalidCodeException on CodeMismatchException', async () => {
      mockCognitoService.confirmSignUp.mockRejectedValue(cognitoError('CodeMismatchException'));

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(InvalidCodeException);
    });

    it('throws CodeExpiredException on ExpiredCodeException', async () => {
      mockCognitoService.confirmSignUp.mockRejectedValue(cognitoError('ExpiredCodeException'));

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(CodeExpiredException);
    });

    it('throws TooManyAttemptsException on TooManyFailedAttemptsException', async () => {
      mockCognitoService.confirmSignUp.mockRejectedValue(
        cognitoError('TooManyFailedAttemptsException'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(TooManyAttemptsException);
    });

    it('throws TooManyAttemptsException on TooManyRequestsException', async () => {
      mockCognitoService.confirmSignUp.mockRejectedValue(cognitoError('TooManyRequestsException'));

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(TooManyAttemptsException);
    });

    it('throws UserNotFoundException on UserNotFoundException', async () => {
      mockCognitoService.confirmSignUp.mockRejectedValue(cognitoError('UserNotFoundException'));

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(UserNotFoundException);
    });

    it('does not call adminGetUser or save when confirmSignUp fails', async () => {
      mockCognitoService.confirmSignUp.mockRejectedValue(cognitoError('CodeMismatchException'));

      await handler.execute(VALID_COMMAND).catch(() => {});

      expect(mockCognitoService.adminGetUser).not.toHaveBeenCalled();
      expect(mockMemberRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── AdminAddUserToGroup failure with rollback ─────────────────────────────

  describe('execute — AdminAddUserToGroup failure with rollback', () => {
    it('calls adminDeleteUser and re-throws when adminAddUserToGroup fails', async () => {
      const groupError = new Error('Group assignment failed');
      mockCognitoService.confirmSignUp.mockResolvedValue(undefined);
      mockCognitoService.adminGetUser.mockResolvedValue(COGNITO_USER);
      mockSeedMemberRepo.findByDni.mockResolvedValue(SEED_RECORD);
      mockCognitoService.adminAddUserToGroup.mockRejectedValue(groupError);
      mockCognitoService.adminDeleteUser.mockResolvedValue(undefined);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(groupError);

      expect(mockCognitoService.adminDeleteUser).toHaveBeenCalledWith(VALID_COMMAND.email);
    });

    it('still re-throws the original error even if rollback also fails', async () => {
      const groupError = new Error('Group assignment failed');
      const rollbackError = new Error('Rollback also failed');
      mockCognitoService.confirmSignUp.mockResolvedValue(undefined);
      mockCognitoService.adminGetUser.mockResolvedValue(COGNITO_USER);
      mockSeedMemberRepo.findByDni.mockResolvedValue(SEED_RECORD);
      mockCognitoService.adminAddUserToGroup.mockRejectedValue(groupError);
      mockCognitoService.adminDeleteUser.mockRejectedValue(rollbackError);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(groupError);
    });
  });

  // ── DynamoDB PutItem failure with rollback ────────────────────────────────

  describe('execute — DynamoDB save failure with rollback', () => {
    it('calls adminDeleteUser and re-throws when memberRepo.save fails', async () => {
      const dbError = new Error('DynamoDB write failed');
      mockCognitoService.confirmSignUp.mockResolvedValue(undefined);
      mockCognitoService.adminGetUser.mockResolvedValue(COGNITO_USER);
      mockSeedMemberRepo.findByDni.mockResolvedValue(SEED_RECORD);
      mockCognitoService.adminAddUserToGroup.mockResolvedValue(undefined);
      mockMemberRepo.save.mockRejectedValue(dbError);
      mockCognitoService.adminDeleteUser.mockResolvedValue(undefined);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(dbError);

      expect(mockCognitoService.adminDeleteUser).toHaveBeenCalledWith(VALID_COMMAND.email);
    });

    it('calls adminDeleteUser exactly once on save failure', async () => {
      const dbError = new Error('DynamoDB write failed');
      mockCognitoService.confirmSignUp.mockResolvedValue(undefined);
      mockCognitoService.adminGetUser.mockResolvedValue(COGNITO_USER);
      mockSeedMemberRepo.findByDni.mockResolvedValue(SEED_RECORD);
      mockCognitoService.adminAddUserToGroup.mockResolvedValue(undefined);
      mockMemberRepo.save.mockRejectedValue(dbError);
      mockCognitoService.adminDeleteUser.mockResolvedValue(undefined);

      await handler.execute(VALID_COMMAND).catch(() => {});

      expect(mockCognitoService.adminDeleteUser).toHaveBeenCalledTimes(1);
    });
  });
});
