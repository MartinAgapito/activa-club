import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for POST /v1/auth/register.
 *
 * Validated by NestJS ValidationPipe (class-validator + class-transformer).
 * All string transforms are applied before validation constraints are evaluated.
 */
export class RegisterMemberRequestDto {
  @ApiProperty({
    description:
      'Argentine national identification number (DNI). 7–8 alphanumeric characters.',
    example: '20345678',
    minLength: 7,
    maxLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'dni is required' })
  @MinLength(7, { message: 'dni must be at least 7 characters' })
  @MaxLength(8, { message: 'dni must be at most 8 characters' })
  @Matches(/^[0-9A-Za-z]+$/, { message: 'dni must contain only alphanumeric characters' })
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

  @ApiPropertyOptional({
    description: 'Full name of the member (2–100 chars). Falls back to seed record value if omitted.',
    example: 'Martin Garcia',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'full_name must be at least 2 characters' })
  @MaxLength(100, { message: 'full_name must be at most 100 characters' })
  full_name?: string;

  @ApiPropertyOptional({
    description: 'Phone number (E.164 format recommended, max 20 chars).',
    example: '+5491112345678',
    maxLength: 20,
  })
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'phone must be at most 20 characters' })
  phone?: string;
}
