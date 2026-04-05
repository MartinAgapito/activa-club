# EP-01: Incorporación de Socios (Member Onboarding)

**Estado:** Done
**Prioridad:** Alta

## Descripción

Flujo completo de incorporación del socio a la plataforma: desde la importación de datos del sistema legado hasta el login con doble factor, logout y gestión de dispositivos confiables.

## Objetivo de Negocio

Permitir que los socios existentes activen su cuenta digital en ActivaClub de forma segura y autónoma, sin intervención manual del staff.

## Stories

| ID     | Título                                                                     | Estado |
|--------|----------------------------------------------------------------------------|--------|
| AC-001 | Importación de datos seed desde sistema legado                             | Done   |
| AC-002 | Registro de socio — validación DNI y creación de cuenta                   | Done   |
| AC-003 | Registro de socio — verificación de email por link y creación de perfil   | Done   |
| AC-004 | Reenvío de link de verificación de email                                   | Done   |
| AC-005 | Login de socio — validación de credenciales                                | Done   |
| AC-006 | Login de socio — verificación OTP y emisión de tokens JWT                  | Done   |
| AC-007 | Frontend — flujo completo de autenticación                                 | Done   |
| AC-008 | Logout del socio — cierre de sesión con revocación de tokens               | Done   |
| AC-009 | Redirección post-login según rol                                           | Done   |
| AC-010 | Recordar dispositivo en login — omisión de OTP en dispositivos confiables  | Done   |

## Criterios de Completitud del Epic

- [x] Todos los socios del sistema legado pueden ser importados vía seed.
- [x] Un socio puede registrarse, verificar su email y acceder a la plataforma.
- [x] El login utiliza doble factor (contraseña + OTP por email).
- [x] El logout revoca los tokens en Cognito.
- [x] Cada rol (Admin, Manager, Member) es redirigido a su dashboard tras el login.
- [x] Los dispositivos confiables omiten el OTP en logins posteriores (30 días).
