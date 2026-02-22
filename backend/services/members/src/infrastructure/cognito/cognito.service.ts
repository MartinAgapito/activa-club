import { Injectable, Logger } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { PasswordPolicyViolationException } from '../../domain/exceptions/member.exceptions';

/**
 * Cognito service.
 *
 * Wraps Amazon Cognito Identity Provider admin API calls required for the
 * member registration flow. This service belongs to the infrastructure layer
 * and must NOT be imported by use case handlers directly — it is injected via
 * the NestJS DI container through MembersModule.
 */
@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor() {
    const region = process.env.COGNITO_REGION ?? process.env.DYNAMODB_REGION ?? 'us-east-1';
    this.userPoolId = process.env.COGNITO_USER_POOL_ID!;

    if (!this.userPoolId) {
      throw new Error('Environment variable COGNITO_USER_POOL_ID is not set');
    }

    this.client = new CognitoIdentityProviderClient({ region });
  }

  /**
   * Creates a new Cognito user with a temporary password.
   * MessageAction SUPPRESS prevents Cognito from sending the default welcome email.
   *
   * @returns The Cognito sub (UUID) of the newly created user.
   */
  async adminCreateUser(email: string, temporaryPassword: string): Promise<string> {
    this.logger.debug(`adminCreateUser: creating user for email=${email}`);

    const command = new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      TemporaryPassword: temporaryPassword,
      MessageAction: MessageActionType.SUPPRESS,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
    });

    const response = await this.client.send(command);
    const sub = response.User?.Attributes?.find((attr) => attr.Name === 'sub')?.Value;

    if (!sub) {
      throw new Error(`Cognito AdminCreateUser did not return a sub for ${email}`);
    }

    this.logger.log(`adminCreateUser: user created with sub=${sub}`);
    return sub;
  }

  /**
   * Sets a permanent password for the Cognito user, bypassing the
   * "force change password" challenge on first login.
   */
  async adminSetUserPassword(email: string, password: string): Promise<void> {
    this.logger.debug(`adminSetUserPassword: setting permanent password for email=${email}`);

    const command = new AdminSetUserPasswordCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'InvalidPasswordException' || error.name === 'InvalidParameterException')
      ) {
        throw new PasswordPolicyViolationException(error.message);
      }
      throw error;
    }
  }

  /**
   * Assigns the Cognito user to the specified user pool group.
   */
  async adminAddUserToGroup(email: string, groupName: string): Promise<void> {
    this.logger.debug(`adminAddUserToGroup: adding email=${email} to group=${groupName}`);

    const command = new AdminAddUserToGroupCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      GroupName: groupName,
    });

    await this.client.send(command);
    this.logger.log(`adminAddUserToGroup: email=${email} added to group=${groupName}`);
  }

  /**
   * Deletes a Cognito user. Used as rollback when downstream operations fail.
   * Callers should catch and log errors from this method — rollback failures
   * must not obscure the original error.
   */
  async adminDeleteUser(email: string): Promise<void> {
    this.logger.debug(`adminDeleteUser: deleting user email=${email} (rollback)`);

    const command = new AdminDeleteUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    });

    await this.client.send(command);
    this.logger.warn(`adminDeleteUser: user email=${email} deleted during rollback`);
  }
}
