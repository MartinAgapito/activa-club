import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDataDto {
  @ApiProperty({
    description: 'New Cognito Access Token. Valid for 60 minutes.',
    example: 'eyJraWQiOiJ...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'New Cognito ID Token containing user claims. Valid for 60 minutes.',
    example: 'eyJraWQiOiJ...',
  })
  idToken: string;

  @ApiProperty({
    description: 'Token TTL in seconds.',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Token type for use in Authorization header.',
    example: 'Bearer',
  })
  tokenType: string;
}
