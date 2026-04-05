# Módulo Terraform: cognito

Crea un Amazon Cognito User Pool con:
- App Client (sin secreto, para SPA con PKCE)
- Grupos: `Admin`, `Manager`, `Member`
- Política de contraseñas y configuración de MFA
- Triggers Lambda opcionales (post-confirmación, pre-generación de tokens)
- Configuración de dispositivos para el flujo "Recordar dispositivo" (AC-010)

## Entradas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `user_pool_name` | string | Nombre del Cognito User Pool |
| `app_client_name` | string | Nombre del App Client |
| `allowed_callback_urls` | list(string) | URLs de callback OAuth (para hosted UI si se usa) |
| `allowed_logout_urls` | list(string) | URLs de logout OAuth |
| `post_confirmation_lambda_arn` | string | Lambda disparada tras confirmar email (opcional) |
| `tags` | map(string) | Tags de recursos AWS |

## Salidas

| Salida | Descripción |
|--------|-------------|
| `user_pool_id` | ID del Cognito User Pool |
| `user_pool_arn` | ARN del Cognito User Pool |
| `client_id` | ID del App Client |
| `issuer_url` | URL del emisor JWT para el autorizador de API Gateway |

## Grupos

| Nombre del Grupo | Descripción |
|-----------------|-------------|
| `Admin` | Acceso completo a la plataforma |
| `Manager` | Gestión de promociones, reportes |
| `Member` | Autoservicio estándar del socio |

## Configuración de Dispositivos (AC-010)

```hcl
device_configuration {
  challenge_required_on_new_device      = true
  device_only_remembered_on_user_prompt = true
}
```

El dispositivo solo se registra como confiable cuando el backend llama explícitamente a `ConfirmDevice` (nunca de forma automática).
