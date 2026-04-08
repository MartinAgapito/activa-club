import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty({
    description: 'Cognito refresh token returned after OTP verification.',
    example: 'eyJjdHkiOiJ...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
