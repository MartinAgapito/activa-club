# Lib: auth

Shared authentication and authorization utilities for all ActivaClub Lambda services.

## Contents

- `cognito.guard.ts` - NestJS guard that validates Cognito JWT tokens from API Gateway
- `roles.guard.ts` - RBAC guard enforcing Cognito group membership (Admin, Manager, Member)
- `roles.decorator.ts` - `@Roles()` decorator for controller methods
- `current-user.decorator.ts` - `@CurrentUser()` parameter decorator to extract claims from request
- `jwt.utils.ts` - JWT verification helpers using `aws-jwt-verify`

## Usage

```typescript
import { CognitoGuard, RolesGuard, Roles, CurrentUser } from '@activa-club/auth';

@UseGuards(CognitoGuard, RolesGuard)
@Roles('Admin', 'Manager')
@Get('/admin/members')
getMembers(@CurrentUser() user: CognitoUser) { ... }
```

## Cognito Groups

| Group   | Description                    |
|---------|--------------------------------|
| Admin   | Full access to all endpoints   |
| Manager | Promotions, reports            |
| Member  | Self-service, reservations     |
