import { Injectable, Logger } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  AdminGetUserCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AttributeType,
  AdminInitiateAuthCommandOutput,
  AdminRespondToAuthChallengeCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Cognito service.
 *
 * Wraps Amazon Cognito Identity Provider API calls required for the member
 * registration (AC-001) and login (AC-002) flows.
 *
 * Authentication modes:
 *   - SignUp / ConfirmSignUp / ResendConfirmationCode — App Client credentials only (clientId).
 *   - AdminGetUser / AdminAddUserToGroup / AdminDeleteUser — IAM role of the Lambda execution role.
 *   - AdminInitiateAuth / AdminRespondToAuthChallenge   — IAM role of the Lambda execution role.
 *
 * This service belongs to the infrastructure layer and MUST NOT be imported
 * directly by use case handlers — it is injected via NestJS DI.
 *
 * Security: passwords and tokens are NEVER logged.
 */
@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;

  constructor() {
    const region = process.env.COGNITO_REGION ?? process.env.DYNAMODB_REGION ?? 'us-east-1';

    this.userPoolId = process.env.COGNITO_USER_POOL_ID!;
    if (!this.userPoolId) {
      throw new Error('Environment variable COGNITO_USER_POOL_ID is not set');
    }

    this.clientId = process.env.COGNITO_CLIENT_ID!;
    if (!this.clientId) {
      throw new Error('Environment variable COGNITO_CLIENT_ID is not set');
    }

    this.client = new CognitoIdentityProviderClient({ region });
  }

  // ─── AC-001: Registration ────────────────────────────────────────────────

  /**
   * Registers a new Cognito user via the public SignUp API.
   * Creates the user in UNCONFIRMED state and triggers Cognito to send
   * a 6-digit OTP to the member's email automatically.
   *
   * @param email    - Member email used as Cognito username.
   * @param password - Member password (never logged).
   * @param dni      - Stored as custom:dni attribute.
   * @returns The Cognito UserSub (UUID) of the newly created user.
   */
  async signUp(email: string, password: string, dni: string): Promise<string> {
    this.logger.debug(`signUp: registering email=${email}`);

    const userAttributes: AttributeType[] = [
      { Name: 'email', Value: email },
      { Name: 'custom:dni', Value: dni },
    ];

    const command = new SignUpCommand({
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    });

    const response = await this.client.send(command);

    const userSub = response.UserSub;
    if (!userSub) {
      throw new Error(`Cognito SignUp did not return a UserSub for ${email}`);
    }

    this.logger.log(`signUp: user created (UNCONFIRMED), sub=${userSub}`);
    return userSub;
  }

  /**
   * Confirms the Cognito account using the 6-digit OTP sent to the member's email.
   * On success, the user transitions from UNCONFIRMED to CONFIRMED state.
   *
   * @param email - Cognito username (email).
   * @param code  - 6-digit OTP entered by the member.
   */
  async confirmSignUp(email: string, code: string): Promise<void> {
    this.logger.debug(`confirmSignUp: confirming email=${email}`);

    const command = new ConfirmSignUpCommand({
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: code,
    });

    await this.client.send(command);
    this.logger.log(`confirmSignUp: email=${email} confirmed successfully`);
  }

  /**
   * Resends the OTP confirmation code to the member's email.
   * Uses the public API — no IAM credentials needed.
   *
   * @param email - Cognito username (email).
   */
  async resendConfirmationCode(email: string): Promise<void> {
    this.logger.debug(`resendConfirmationCode: resending code to email=${email}`);

    const command = new ResendConfirmationCodeCommand({
      ClientId: this.clientId,
      Username: email,
    });

    await this.client.send(command);
    this.logger.log(`resendConfirmationCode: new code sent to email=${email}`);
  }

  /**
   * Fetches user attributes from Cognito for a confirmed user.
   * Used in verify-email to read custom:dni and sub after ConfirmSignUp.
   *
   * @param email - Cognito username (email).
   * @returns Object with sub and dni extracted from UserAttributes.
   */
  async adminGetUser(email: string): Promise<{ sub: string; dni: string }> {
    this.logger.debug(`adminGetUser: fetching user attributes for email=${email}`);

    const command = new AdminGetUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    });

    const response = await this.client.send(command);

    const attrs = response.UserAttributes ?? [];
    const sub = attrs.find((a) => a.Name === 'sub')?.Value;
    const dni = attrs.find((a) => a.Name === 'custom:dni')?.Value;

    if (!sub) {
      throw new Error(`Cognito AdminGetUser: sub attribute not found for ${email}`);
    }
    if (!dni) {
      throw new Error(`Cognito AdminGetUser: custom:dni attribute not found for ${email}`);
    }

    this.logger.debug(`adminGetUser: resolved sub=${sub} for email=${email}`);
    return { sub, dni };
  }

  /**
   * Assigns the Cognito user to the specified user pool group.
   * Requires Lambda IAM role with cognito-idp:AdminAddUserToGroup permission.
   *
   * @param email     - Cognito username (email).
   * @param groupName - Name of the Cognito group (e.g., "Member").
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
   * Callers must catch errors from this method — rollback failures must not
   * obscure the original error.
   *
   * @param email - Cognito username (email).
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

  // ─── AC-002: Login ───────────────────────────────────────────────────────

  /**
   * Initiates authentication with USER_PASSWORD_AUTH flow.
   * Requires Lambda IAM role with cognito-idp:AdminInitiateAuth permission.
   *
   * When email MFA is ON, Cognito returns an EMAIL_OTP challenge.
   * The response contains ChallengeName and Session (opaque, 3-minute TTL).
   *
   * @param email    - Member email (used as Cognito USERNAME).
   * @param password - Member password (never logged).
   */
  async adminInitiateAuth(
    email: string,
    password: string,
  ): Promise<AdminInitiateAuthCommandOutput> {
    this.logger.debug(`adminInitiateAuth: initiating auth for email=${email}`);

    const command = new AdminInitiateAuthCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await this.client.send(command);
    this.logger.debug(
      `adminInitiateAuth: received challenge=${response.ChallengeName ?? 'none'} for email=${email}`,
    );
    return response;
  }

  /**
   * Responds to the EMAIL_OTP challenge with the code submitted by the member.
   * Requires Lambda IAM role with cognito-idp:AdminRespondToAuthChallenge permission.
   *
   * On success, Cognito returns AuthenticationResult containing AccessToken,
   * IdToken, and RefreshToken.
   *
   * @param email   - Cognito USERNAME.
   * @param session - Opaque session token from adminInitiateAuth response.
   * @param otp     - 6-digit OTP code entered by the member.
   */
  async adminRespondToAuthChallenge(
    email: string,
    session: string,
    otp: string,
  ): Promise<AdminRespondToAuthChallengeCommandOutput> {
    this.logger.debug(`adminRespondToAuthChallenge: responding to EMAIL_OTP for email=${email}`);

    const command = new AdminRespondToAuthChallengeCommand({
      UserPoolId: this.userPoolId,
      ClientId: this.clientId,
      ChallengeName: 'EMAIL_OTP',
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        EMAIL_OTP_CODE: otp,
      },
    });

    const response = await this.client.send(command);
    this.logger.log(`adminRespondToAuthChallenge: authentication successful for email=${email}`);
    return response;
  }
}
