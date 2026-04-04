# AC-010: Recordar Dispositivo en Login — Omisión de OTP en Dispositivos Confiables

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Media
**Story Points:** 5
**Estado:** Backlog
**Fecha:** 2026-04-03
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

- AC-005 completado: el endpoint `POST /v1/auth/login` está implementado y operativo.
- AC-006 completado: el endpoint `POST /v1/auth/verify-otp` está implementado y operativo.
- AC-007 completado: el frontend tiene la pantalla `VerifyOtpPage` implementada.
- El Cognito User Pool tiene `DeviceConfiguration` habilitado con:
  - `challenge_required_on_new_device = true`
  - `device_only_remembered_on_user_prompt = true` (el registro del dispositivo se activa solo cuando el socio lo solicita explícitamente via checkbox).
- El socio tiene una cuenta con estado `CONFIRMED` y ha completado al menos un login exitoso con OTP previamente.

---

## Criterios de Aceptación

- [ ] En la pantalla `VerifyOtpPage`, el socio ve un checkbox "Recordar este dispositivo por 30 días" desmarcado por defecto.
- [ ] Si el socio marca el checkbox y el OTP es válido, el backend llama a `ConfirmDevice` en Cognito para registrar el dispositivo como confiable, incluyendo el `DeviceKey` y el verifier de contraseña del dispositivo.
- [ ] Si el socio no marca el checkbox, el flujo de login continúa sin registrar el dispositivo; el siguiente login desde ese dispositivo vuelve a pedir OTP.
- [ ] En un login posterior desde un dispositivo ya registrado: el backend detecta que Cognito retorna el challenge `DEVICE_SRP_AUTH` o `DEVICE_PASSWORD_VERIFIER` en lugar de `EMAIL_OTP`, y lo responde automáticamente sin involucrar al socio.
- [ ] Si el challenge de dispositivo es respondido correctamente, el backend retorna HTTP 200 con los tokens JWT directamente desde `POST /v1/auth/login`, sin pasar por `POST /v1/auth/verify-otp`.
- [ ] El `DeviceKey` recibido de Cognito tras el OTP exitoso es devuelto al frontend por el endpoint `POST /v1/auth/verify-otp` y almacenado en `localStorage` (es seguro: no contiene credenciales ni tiene valor por sí solo).
- [ ] El frontend envía el `DeviceKey` almacenado en `localStorage` como parte del body de `POST /v1/auth/login` en cada intento posterior (puede ser `null` si no existe).
- [ ] Si el dispositivo fue registrado hace más de 30 días o fue olvidado en Cognito, Cognito retorna `EMAIL_OTP` normalmente y el flujo de doble factor se reanuda sin errores.
- [ ] Si el `DeviceKey` enviado por el frontend no es reconocido por Cognito (dispositivo inválido o expirado), el backend responde el challenge de dispositivo fallido con gracia y continúa el flujo normal de OTP.
- [ ] Todos los errores relacionados con el flujo de dispositivo siguen el esquema estándar `{ status, error: { code, message } }` y son mapeados a mensajes amigables en español en el frontend.

---

## Fuera de Alcance

- Gestión de dispositivos recordados (listar, revocar) desde el panel de administración — diferida a historia futura de gestión de seguridad de cuenta.
- Gestión de dispositivos recordados por el propio socio desde su perfil — diferida a historia futura de perfil y seguridad.
- Soporte para múltiples dispositivos con nombres personalizados — no forma parte del MVP.
- Notificación al socio cuando se registra un nuevo dispositivo — diferida a historia futura de notificaciones de seguridad.

---

## Reglas de Negocio

- **Período de vigencia:** Un dispositivo registrado es válido por 30 días; tras ese período Cognito lo invalida automáticamente y el flujo de OTP se reanuda sin intervención del sistema.
- **Consentimiento explícito:** El dispositivo solo se registra si el socio marca el checkbox "Recordar este dispositivo"; nunca se registra de forma automática sin consentimiento.
- **DeviceKey en localStorage:** El `DeviceKey` de Cognito puede almacenarse en `localStorage` porque no contiene información de sesión ni credenciales; su valor sin las credenciales del usuario es nulo desde el punto de vista de seguridad.
- **AccessToken e IdToken NO en localStorage:** Esta regla heredada de AC-006 y AC-007 se mantiene; solo el `DeviceKey` va a `localStorage`.
- **Transparencia ante el socio:** Si el dispositivo no es reconocido o expiró, el flujo vuelve a pedir OTP sin mensajes de error confusos; el socio simplemente ve la pantalla de verificación OTP de forma normal.
- **Sin llamadas directas a Cognito desde el frontend:** El frontend nunca llama a Cognito directamente; toda la lógica de dispositivo (ConfirmDevice, respuesta de challenges DEVICE_SRP_AUTH/DEVICE_PASSWORD_VERIFIER) se ejecuta en el backend Lambda.
- **Cognito DeviceConfiguration:** El User Pool debe tener `device_only_remembered_on_user_prompt = true` en el recurso Terraform `aws_cognito_user_pool`, de modo que Cognito solo recuerde el dispositivo cuando el backend llama explícitamente a `ConfirmDevice`.

---

## Dependencias

| Historia / Artefacto       | Motivo                                                                                                      |
|----------------------------|-------------------------------------------------------------------------------------------------------------|
| AC-005                     | El endpoint de login es el punto de entrada donde se detecta el challenge de dispositivo en logins posteriores. |
| AC-006                     | El endpoint verify-otp es donde se llama a `ConfirmDevice` si el socio marcó el checkbox.                   |
| AC-007                     | La pantalla `VerifyOtpPage` debe actualizarse para incluir el checkbox y transmitir la decisión al backend. |
| `aws_cognito_user_pool`    | El recurso Terraform del User Pool requiere configurar `device_configuration` con los atributos correctos.  |

---

## Definition of Done

- [ ] Endpoint backend implementado y desplegado en dev.
- [ ] Reglas de negocio validadas en el backend (ConfirmDevice, respuesta de challenges de dispositivo).
- [ ] Control de acceso por rol (RBAC) aplicado — solo socios con sesión activa pueden marcar el checkbox.
- [ ] Pantalla `VerifyOtpPage` actualizada con checkbox "Recordar este dispositivo" y lógica de envío de `DeviceKey`.
- [ ] Frontend almacena `DeviceKey` en `localStorage` y lo envía en cada intento de login.
- [ ] Errores del API mapeados a mensajes amigables en español.
- [ ] Recurso Terraform `aws_cognito_user_pool` actualizado con `device_configuration`.
- [ ] Tests unitarios escritos y pasando (flujo con dispositivo recordado, flujo sin checkbox, dispositivo expirado/inválido).
- [ ] Probado manualmente en ambiente dev (primer login con checkbox, segundo login sin OTP, login tras 30 días).
- [ ] Código revisado y aprobado.
- [ ] Listo para despliegue.

---

## Notas Técnicas

- **Stack backend:** NestJS Lambda — módulo `auth`. Nuevos métodos en `AuthService`: `confirmDevice(deviceKey, deviceGroupKey, accessToken)` y lógica de detección y respuesta de challenges `DEVICE_SRP_AUTH` / `DEVICE_PASSWORD_VERIFIER` en el flujo de `AdminInitiateAuth`.
- **Stack frontend:** React + TypeScript. Actualización de `VerifyOtpPage` (checkbox), `useAuthStore` (Zustand, campo `deviceKey`), y `loginService` (envío del `DeviceKey` en el request).
- **IaC:** Terraform — bloque `device_configuration` en `aws_cognito_user_pool`:
  ```hcl
  device_configuration {
    challenge_required_on_new_device     = true
    device_only_remembered_on_user_prompt = true
  }
  ```
- **Cognito SDK calls relevantes:** `ConfirmDevice`, `AdminInitiateAuth` (detección de `DEVICE_SRP_AUTH`), `AdminRespondToAuthChallenge` (respuesta de challenge de dispositivo).
- **Design Doc:** Por crear en `docs/design/AC-010-design.md`.
