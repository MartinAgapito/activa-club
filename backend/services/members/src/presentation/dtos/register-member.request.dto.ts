import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for POST /v1/auth/register — AC-001 Rev2.
 *
 * The member provides only DNI, email and password.
 * Full name, phone and membership_type are read from SeedMembersTable
 * at verify-email time (Step 2) — the member never needs to type them.
 */
export class RegisterMemberRequestDto {
  @ApiProperty({
    description: 'Argentine national identification number (DNI). 7–8 numeric characters.',
    example: '20345678',
    minLength: 7,
    maxLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'dni is required' })
  @MinLength(7, { message: 'dni must be at least 7 characters' })
  @MaxLength(8, { message: 'dni must be at most 8 characters' })
  @Matches(/^\d+$/, { message: 'dni must contain only numeric characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  dni: string;

  @ApiProperty({
    description: 'Email address (RFC 5322, max 254 chars). Stored in lowercase.',
    example: 'martin.garcia@email.com',
    maxLength: 254,
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  @MaxLength(254, { message: 'email must be at most 254 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @ApiProperty({
    description:
      'Password. Min 8 chars, at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character.',
    example: 'SecurePass1!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character',
  })
  password: string;
}
