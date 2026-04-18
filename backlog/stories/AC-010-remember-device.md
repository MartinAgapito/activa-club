# AC-010: Recordar Dispositivo en Login — Omisión de OTP en Dispositivos Confiables

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Media
**Story Points:** 5
**Estado:** Done
**Fecha:** 2026-04-03
**Última actualización:** 2026-04-17
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio registrado,
Quiero que el sistema recuerde mi dispositivo después del primer login exitoso con OTP,
Para no tener que ingresar el código OTP en cada login posterior desde ese mismo dispositivo durante un período de 30 días.

---

## Valor de Negocio

Solicitar un OTP en cada login, incluso desde el dispositivo habitual del socio, genera fricción innecesaria
y aumenta el abandono de la sesión. Al recordar el dispositivo después del primer login exitoso con doble factor,
se mantiene el nivel de seguridad inicial (el OTP se exigió la primera vez) sin degradar la experiencia
en los accesos cotidianos. El período de 30 días garantiza que el dispositivo sea re-verificado periódicamente,
equilibrando seguridad y usabilidad.

---

## Personas Involucradas

| Persona          | Rol    | Interacción                                                                                        |
|------------------|--------|----------------------------------------------------------------------------------------------------|
| Socio Registrado | Member | En el primer login exitoso con OTP, puede optar por recordar el dispositivo. En los siguientes logins desde ese dispositivo, el OTP es omitido automáticamente. |
| Administrador    | Admin  | Puede consultar dispositivos recordados por socio en el panel de administración (fuera de alcance de esta historia). |

---

## Precondiciones

- AC-005 y AC-006 completados: flujo de login con OTP operativo (`POST /v1/auth/login` + `POST /v1/auth/verify-otp`).
- AC-007 completado: la pantalla de verificación OTP está implementada en el frontend (`VerifyOtpPage`).
- El App Client de Cognito tiene `refresh_token_validity = 30 days` configurado en Terraform.
- El bloque `device_configuration` está **ausente** del recurso `aws_cognito_user_pool` en Terraform.
- El socio tiene una cuenta con estado `CONFIRMED` y ha completado al menos un login exitoso con OTP previamente.

---

## Criterios de Aceptación

- [x] En la pantalla `VerifyOtpPage`, el socio ve un checkbox "Recordar este dispositivo por 30 días" desmarcado por defecto.
- [x] Si el socio marca el checkbox y el OTP es válido, el backend incluye el `refreshToken` en la respuesta y el frontend lo guarda en `localStorage` bajo la clave `activa-club-refresh-token`.
- [x] Si el socio no marca el checkbox, el `refreshToken` no se guarda en `localStorage`; el siguiente login desde ese dispositivo pedirá OTP normalmente.
- [x] Al volver a abrir el browser (nueva sesión) desde un dispositivo recordado, `LoginPage` detecta el token en `localStorage`, hace un silent refresh al backend (`POST /v1/auth/refresh`), obtiene nuevos tokens y redirige al dashboard sin mostrar el formulario de login.
- [x] Al hacer login con credenciales desde un dispositivo recordado (el refresh token ya está en localStorage), el formulario intenta silenciosamente el refresh primero; si tiene éxito, redirige al dashboard sin pedir OTP.
- [x] Si el refresh token expiró (30 días) o fue revocado, el backend responde con error, el frontend elimina el token de `localStorage` y continúa el flujo normal (email + password → OTP).
- [x] Todos los errores del endpoint de refresh siguen el esquema estándar `{ status, error: { code, message } }` y son mapeados a comportamientos amigables en el frontend.

---

## Fuera de Alcance

- Gestión de dispositivos recordados (listar, revocar) desde el panel de administración — diferida a historia futura de gestión de seguridad de cuenta.
- Gestión de dispositivos recordados por el propio socio desde su perfil — diferida a historia futura de perfil y seguridad.
- Soporte para múltiples dispositivos con nombres personalizados — no forma parte del MVP.
- Notificación al socio cuando se registra un nuevo dispositivo — diferida a historia futura de notificaciones de seguridad.

---

## Reglas de Negocio

- **Período de vigencia:** El refresh token es válido por 30 días (configurado en el App Client de Cognito con `refresh_token_validity = 30` + `token_validity_units.refresh_token = "days"`). Tras ese período el token expira y el flujo de OTP se reanuda automáticamente.
- **Consentimiento explícito:** El refresh token solo se persiste en `localStorage` si el socio marca el checkbox "Recordar este dispositivo"; nunca se guarda automáticamente sin consentimiento.
- **Refresh token en localStorage:** El refresh token puede almacenarse en `localStorage` porque requiere credenciales adicionales para obtener tokens de acceso y el backend valida su autenticidad contra Cognito.
- **Tokens de acceso e identidad NO en localStorage:** `idToken` y `user` se persisten en `sessionStorage` (se limpian al cerrar el browser). `accessToken` solo vive en memoria (no persiste en absoluto). Solo el `refreshToken` va a `localStorage`.
- **Transparencia ante el socio:** Si el refresh token expiró, el frontend elimina el token silenciosamente y muestra el formulario de login normal. El socio no ve mensajes de error confusos.
- **Soft logout preserva el refresh token:** Al cerrar sesión, el `refreshToken` en `localStorage` se conserva deliberadamente. En el próximo login, el formulario intentará el refresh automáticamente (sin OTP) antes de seguir el flujo normal.
- **Sin Cognito device tracking:** La implementación NO usa el mecanismo de `device_configuration` de Cognito (DEVICE_SRP_AUTH, ConfirmDevice). Ese mecanismo fue descartado porque vincula el refresh token a un device key, causando que `REFRESH_TOKEN_AUTH` falle si no se envía el device key.

---

## Dependencias

| Historia / Artefacto       | Motivo                                                                                                      |
|----------------------------|-------------------------------------------------------------------------------------------------------------|
| AC-005                     | El endpoint `POST /v1/auth/login` inicia el flujo de autenticación que desemboca en OTP.                   |
| AC-006                     | El endpoint `POST /v1/auth/verify-otp` devuelve el `refreshToken` cuando `rememberDevice=true`.             |
| AC-007                     | La pantalla `VerifyOtpPage` incluye el checkbox y envía `rememberDevice` al backend.                       |
| `aws_cognito_user_pool`    | El App Client debe tener `refresh_token_validity = 30 days`. El bloque `device_configuration` debe estar **ausente** (cualquier presencia activa el device tracking de Cognito y causa "Invalid Refresh Token"). |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/refresh` implementado y desplegado en dev; devuelve nuevos `idToken` y `accessToken` a partir de un `refreshToken` válido.
- [x] `POST /v1/auth/verify-otp` devuelve `refreshToken` en la respuesta cuando `rememberDevice=true`.
- [x] `VerifyOtpPage` incluye el checkbox, lee la respuesta y guarda el `refreshToken` en `localStorage` si el socio optó por recordar el dispositivo.
- [x] `LoginPage` hace silent refresh al montar (si hay token en localStorage y no hay flag de logout).
- [x] `LoginPage.onSubmit` intenta el refresh silencioso antes del flujo normal (email+password→OTP).
- [x] Flag `activa-club-logged-out` en sessionStorage previene el silent refresh inmediatamente después del logout explícito.
- [x] Recurso Terraform `aws_cognito_user_pool` NO tiene bloque `device_configuration` (ausencia intencional).
- [x] Errores del API mapeados a comportamientos amigables en el frontend (token expirado → elimina token silenciosamente → formulario normal).
- [x] Probado manualmente en ambiente dev (primer login con checkbox → dashboard sin OTP al reabrir; logout → formulario; login con credenciales → dashboard sin OTP).
- [x] Código revisado y aprobado.
- [x] Listo para despliegue.

---

## Notas Técnicas

- **Implementación real — Refresh Token como mecanismo de "device":**
  El "recuerdo de dispositivo" se implementa con el refresh token de Cognito (30 días de validez), almacenado en `localStorage`. No se usa el sistema de device tracking de Cognito (`ConfirmDevice`, `DEVICE_SRP_AUTH`).

- **Por qué NO se usa Cognito device tracking:**
  Cuando el bloque `device_configuration` está presente en el recurso Terraform (incluso con `device_only_remembered_on_user_prompt = false`), Cognito activa el modo "always remember all devices". Esto vincula el refresh token al device key, haciendo que `REFRESH_TOKEN_AUTH` falle con "Invalid Refresh Token." si no se envía el `DEVICE_KEY` en cada llamada. La solución correcta es **omitir completamente** el bloque `device_configuration`.

- **Stack backend:**
  - `POST /v1/auth/verify-otp`: acepta `rememberDevice: boolean` en el body; si es `true`, incluye `refreshToken` en la respuesta.
  - `POST /v1/auth/refresh`: acepta `{ refreshToken: string }` en el body; llama a `AdminInitiateAuth` con `REFRESH_TOKEN_AUTH` flow y devuelve nuevos `idToken` y `accessToken`.

- **Stack frontend:**
  - `VerifyOtpPage.tsx`: checkbox UI + guarda `refreshToken` en `localStorage` si `rememberDevice=true`.
  - `LoginPage.tsx`: silent refresh al montar + intento de refresh en `onSubmit` antes del OTP flow.
  - `auth.store.ts`: `logout()` establece flag `activa-club-logged-out` en sessionStorage.
  - `Header.tsx`: navega con React Router `navigate()` después del logout (evita race condition con sessionStorage).

- **IaC:** Recurso Terraform `aws_cognito_user_pool` — bloque `device_configuration` **ausente** (intencional). Ver `infrastructure/modules/cognito/main.tf`.

- **Claves de almacenamiento:**
  - `activa-club-refresh-token` → `localStorage` (sobrevive browser close, 30 días)
  - `activa-club-auth` → `sessionStorage` (Zustand persist: `user`, `idToken`, `isAuthenticated`)
  - `activa-club-logged-out` → `sessionStorage` (flag temporal, se elimina al leer)
