import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { RegisterMemberRequestDto } from '../dtos/register-member.request.dto';
import { RegisterMemberResponseDto, RegisterMemberDataDto } from '../dtos/register-member.response.dto';
import { RegisterMemberHandler } from '../../application/commands/register-member/register-member.handler';
import { RegisterMemberCommand } from '../../application/commands/register-member/register-member.command';

/**
 * Auth controller — public registration endpoints.
 *
 * All routes in this controller are public (no JWT required).
 * Business logic lives exclusively in the use case handler — this
 * controller only translates HTTP input to commands and shapes the response.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly registerMemberHandler: RegisterMemberHandler) {}

  /**
   * POST /v1/auth/register
   *
   * Registers a new member by:
   *   1. Validating their DNI against the seed table.
   *   2. Creating a Cognito identity with a permanent password.
   *   3. Persisting the member profile in DynamoDB.
   *
   * This endpoint is public — no Authorization header is required.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new member',
    description:
      'Validates the DNI against the pre-seeded member list, creates a Cognito user, and persists the member profile. Public endpoint — no authentication required.',
  })
  @ApiBody({ type: RegisterMemberRequestDto })
  @ApiCreatedResponse({
    description: 'Member registered successfully.',
    type: RegisterMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error — one or more fields are missing or malformed.',
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
    description: 'PASSWORD_POLICY_VIOLATION — Cognito rejected the supplied password.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'INTERNAL_ERROR — unexpected server-side failure.',
  })
  async register(@Body() dto: RegisterMemberRequestDto): Promise<RegisterMemberResponseDto> {
    this.logger.log(`POST /v1/auth/register — dni=${dto.dni}, email=${dto.email}`);

    const command = new RegisterMemberCommand(
      dto.dni,
      dto.email,
      dto.password,
      dto.full_name,
      dto.phone,
    );

    const result = await this.registerMemberHandler.execute(command);

    const data: RegisterMemberDataDto = {
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
      message:
        'Registration successful. Please check your email to confirm your account.',
    };
  }
}
