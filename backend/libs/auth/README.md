# Librería: auth

Utilidades compartidas de autenticación y autorización para todos los servicios Lambda de ActivaClub.

## Contenido

- `cognito.guard.ts` — Guard de NestJS que valida tokens JWT de Cognito provenientes de API Gateway
- `roles.guard.ts` — Guard RBAC que verifica la pertenencia a grupos Cognito (Admin, Manager, Member)
- `roles.decorator.ts` — Decorador `@Roles()` para métodos de controlador
- `current-user.decorator.ts` — Decorador `@CurrentUser()` para extraer los claims del request
- `jwt.utils.ts` — Helpers de verificación JWT usando `aws-jwt-verify`

## Uso

```typescript
import { CognitoGuard, RolesGuard, Roles, CurrentUser } from '@activa-club/auth';

@UseGuards(CognitoGuard, RolesGuard)
@Roles('Admin', 'Manager')
@Get('/admin/members')
getMembers(@CurrentUser() user: CognitoUser) { ... }
```

## Grupos Cognito

| Grupo   | Descripción |
|---------|-------------|
| Admin   | Acceso completo a todos los endpoints |
| Manager | Promociones y reportes |
| Member  | Autoservicio, reservas |
