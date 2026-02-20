import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/jwt-auth.guard';

/**
 * @Public decorator.
 *
 * Marks a route or controller as publicly accessible — bypasses JwtAuthGuard.
 *
 * @example
 * @Public()
 * @Post('onboard')
 * onboard(@Body() dto: OnboardMemberDto) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
