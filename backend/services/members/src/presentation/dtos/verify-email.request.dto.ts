import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for POST /v1/auth/verify-email — AC-001 Rev2 Step 2.
 */
export class VerifyEmailRequestDto {
  @ApiProperty({
    description: 'Email address used during registration. Must match exactly.',
    example: 'martin.garcia@email.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @ApiProperty({
    description:
      'The 6-digit numeric OTP sent by Cognito to the member\'s email.',
    example: '482917',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  @Length(6, 6, { message: 'code must be exactly 6 characters' })
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 numeric digits' })
  code: string;
}
