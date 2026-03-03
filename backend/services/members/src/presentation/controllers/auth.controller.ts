import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiAcceptedResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';

// Request DTOs
import { RegisterMemberRequestDto } from '../dtos/register-member.request.dto';
import { VerifyEmailRequestDto } from '../dtos/verify-email.request.dto';
import { ResendCodeRequestDto } from '../dtos/resend-code.request.dto';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { VerifyOtpRequestDto } from '../dtos/verify-otp.request.dto';

// Response DTOs
import {
  RegisterMemberResponseDto,
  RegisterMemberDataDto,
} from '../dtos/register-member.response.dto';
import { VerifyEmailResponseDto, VerifyEmailDataDto } from '../dtos/verify-email.response.dto';
import { LoginResponseDto, LoginDataDto } from '../dtos/login.response.dto';
import { VerifyOtpResponseDto, VerifyOtpDataDto } from '../dtos/verify-otp.response.dto';

// Commands
import { RegisterMemberCommand } from '../../application/commands/register-member/register-member.command';
import { VerifyEmailCommand } from '../../application/commands/verify-email/verify-email.command';
import { ResendCodeCommand } from '../../application/commands/resend-code/resend-code.command';
import { LoginCommand } from '../../application/commands/login/login.command';
import { VerifyOtpCommand } from '../../application/commands/verify-otp/verify-otp.command';

// Handlers
import { RegisterMemberHandler } from '../../application/commands/register-member/register-member.handler';
import { VerifyEmailHandler } from '../../application/commands/verify-email/verify-email.handler';
import { ResendCodeHandler } from '../../application/commands/resend-code/resend-code.handler';
import { LoginHandler } from '../../application/commands/login/login.handler';
import { VerifyOtpHandler } from '../../application/commands/verify-otp/verify-otp.handler';

/**
 * Auth controller — all public auth endpoints.
 *
 * Routes:
 *   POST /v1/auth/register      — AC-001 Step 1: DNI validation + Cognito SignUp (→ 202)
 *   POST /v1/auth/verify-email  — AC-001 Step 2: OTP confirmation + profile creation (→ 201)
 *   POST /v1/auth/resend-code   — AC-001 Support: resend OTP to email (→ 200)
 *   POST /v1/auth/login         — AC-002 Step 1: credential validation → EMAIL_OTP challenge (→ 200)
 *   POST /v1/auth/verify-otp    — AC-002 Step 2: OTP challenge response → JWT tokens (→ 200)
 *
 * All routes are public — no JWT authorizer is required.
 * No business logic lives in this controller; it only translates
 * HTTP input to commands and shapes the response.
 *
 * Security: passwords and tokens are never logged.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly registerMemberHandler: RegisterMemberHandler,
    private readonly verifyEmailHandler: VerifyEmailHandler,
    private readonly resendCodeHandler: ResendCodeHandler,
    private readonly loginHandler: LoginHandler,
    private readonly verifyOtpHandler: VerifyOtpHandler,
  ) {}

  // ─── AC-001 Step 1: POST /v1/auth/register ────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Register a new member (Step 1)',
    description:
      'Validates the DNI against the seed table, checks for duplicates, then calls Cognito SignUp to create an UNCONFIRMED user and send a 6-digit OTP to the provided email. Returns HTTP 202 — the account is not yet active.',
  })
  @ApiBody({ type: RegisterMemberRequestDto })
  @ApiAcceptedResponse({
    description: 'OTP sent — account pending email verification.',
    type: RegisterMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'VALIDATION_ERROR — one or more fields are missing or malformed.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'ACCOUNT_INACTIVE — the seed record for this DNI is marked inactive.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'DNI_NOT_FOUND — the provided DNI does not exist in the seed table.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'DNI_ALREADY_REGISTERED or EMAIL_ALREADY_IN_USE.',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'PASSWORD_POLICY_VIOLATION — the password does not meet the security policy.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'INTERNAL_ERROR — unexpected server-side failure.',
  })
  async register(@Body() dto: RegisterMemberRequestDto): Promise<RegisterMemberResponseDto> {
    this.logger.log(`Received registration request for DNI=${dto.dni} and email=${dto.email}`);
    this.logger.log(`POST /v1/auth/register — dni=${dto.dni}, email=${dto.email}`);

    const command = new RegisterMemberCommand(dto.dni, dto.email, dto.password);

    const result = await this.registerMemberHandler.execute(command);

    const data: RegisterMemberDataDto = {
      email: result.email,
      message:
        'A verification code has been sent to your email. Please enter it to activate your account.',
    };

    return { status: 'success', data };
  }

  // ─── AC-001 Step 2: POST /v1/auth/verify-email ────────────────────────────

  @Post('verify-email')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Verify email OTP (Step 2)',
    description:
      'Confirms the Cognito account with the 6-digit OTP, assigns the user to the Member group, and creates the member profile in DynamoDB. Returns HTTP 201 — account is now active.',
  })
  @ApiBody({ type: VerifyEmailRequestDto })
  @ApiCreatedResponse({
    description: 'Account activated — member profile created.',
    type: VerifyEmailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'VALIDATION_ERROR or INVALID_CODE — malformed fields or wrong OTP.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'USER_NOT_FOUND — no UNCONFIRMED user for this email.',
  })
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'CODE_EXPIRED — OTP TTL exceeded.',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'TOO_MANY_ATTEMPTS — too many incorrect verification attempts.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'INTERNAL_ERROR — DynamoDB write failed (Cognito user rolled back).',
  })
  async verifyEmail(@Body() dto: VerifyEmailRequestDto): Promise<VerifyEmailResponseDto> {
    this.logger.log(`POST /v1/auth/verify-email — email=${dto.email}`);

    const command = new VerifyEmailCommand(dto.email, dto.code);
    const result = await this.verifyEmailHandler.execute(command);

    const data: VerifyEmailDataDto = {
      member_id: result.memberId,
      full_name: result.fullName,
      email: result.email,
      membership_type: result.membershipType,
      account_status: result.accountStatus,
      created_at: result.createdAt,
    };

    return {
      status: 'success',
      data,
      message: 'Account successfully activated. You can now sign in.',
    };
  }

  // ─── AC-001 Support: POST /v1/auth/resend-code ────────────────────────────

  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification code',
    description:
      "Calls Cognito ResendConfirmationCode to send a new 6-digit OTP to the member's email when the original code expired or was not received.",
  })
  @ApiBody({ type: ResendCodeRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "New OTP sent to the member's email.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'USER_NOT_FOUND — no UNCONFIRMED user for this email.',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'TOO_MANY_ATTEMPTS — Cognito rate limit on resend.',
  })
  async resendCode(
    @Body() dto: ResendCodeRequestDto,
  ): Promise<{ status: string; data: { message: string } }> {
    this.logger.log(`POST /v1/auth/resend-code — email=${dto.email}`);

    const command = new ResendCodeCommand(dto.email);
    await this.resendCodeHandler.execute(command);

    return {
      status: 'success',
      data: { message: 'A new verification code has been sent to your email.' },
    };
  }

  // ─── AC-002 Step 1: POST /v1/auth/login ───────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login — credential validation (Step 1)',
    description:
      'Validates email and password via Cognito AdminInitiateAuth (USER_PASSWORD_AUTH). When MFA is ON, Cognito sends a 6-digit OTP to the verified email and returns an EMAIL_OTP challenge with a 3-minute session token.',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Credentials valid — EMAIL_OTP challenge issued.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'VALIDATION_ERROR — missing or malformed fields.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'INVALID_CREDENTIALS — wrong email or password.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'ACCOUNT_NOT_CONFIRMED or ACCOUNT_DISABLED.',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'TOO_MANY_ATTEMPTS — Cognito rate limiting.',
  })
  async login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    // Password is intentionally not logged
    this.logger.log(`POST /v1/auth/login — email=${dto.email}`);

    const command = new LoginCommand(dto.email, dto.password);
    const result = await this.loginHandler.execute(command);

    const data: LoginDataDto = {
      challengeName: result.challengeName,
      session: result.session,
      message: 'A verification code has been sent to your email.',
    };

    return { status: 'success', data };
  }

  // ─── AC-002 Step 2: POST /v1/auth/verify-otp ──────────────────────────────

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login — OTP challenge response (Step 2)',
    description:
      'Responds to the Cognito EMAIL_OTP challenge with the 6-digit code. On success, Cognito returns AccessToken, IdToken, and RefreshToken.',
  })
  @ApiBody({ type: VerifyOtpRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authentication complete — tokens returned.',
    type: VerifyOtpResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'INVALID_OTP — the OTP code is incorrect.',
  })
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'SESSION_EXPIRED — the Cognito session token has expired (3-minute TTL).',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'TOO_MANY_ATTEMPTS — too many incorrect OTP attempts.',
  })
  async verifyOtp(@Body() dto: VerifyOtpRequestDto): Promise<VerifyOtpResponseDto> {
    this.logger.log(`POST /v1/auth/verify-otp — email=${dto.email}`);

    const command = new VerifyOtpCommand(dto.email, dto.session, dto.otp);
    const result = await this.verifyOtpHandler.execute(command);

    // Tokens are intentionally not logged
    const data: VerifyOtpDataDto = {
      accessToken: result.accessToken,
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
    };

    return { status: 'success', data };
  }
}
