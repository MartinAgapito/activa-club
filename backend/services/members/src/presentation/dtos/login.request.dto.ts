import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for POST /v1/auth/login — AC-002 Step 1.
 *
 * Password is a string with IsNotEmpty only — Cognito enforces policy.
 * Password is never logged anywhere in the application layer.
 */
export class LoginRequestDto {
  @ApiProperty({
    description: 'Member email address. Lowercased before use.',
    example: 'martin.garcia@email.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @ApiProperty({
    description: 'Member password. Validated by Cognito.',
    example: 'SecurePass1!',
  })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  password: string;
}
