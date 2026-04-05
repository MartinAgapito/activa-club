# AC-010: Recordar Dispositivo en Login — Omisión de OTP en Dispositivos Confiables

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Media
**Story Points:** 5
**Estado:** Done
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

- AC-005 y AC-006 completados: flujo de login con OTP operativo.
- AC-007 completado: la pantalla de verificación OTP está implementada en el frontend.
- La configuración del proveedor de identidad soporta el registro de dispositivos bajo demanda (solo cuando el socio lo solicita).
- El socio tiene una cuenta con estado `CONFIRMED` y ha completado al menos un login exitoso con OTP previamente.

---

## Criterios de Aceptación

- [x] En la pantalla `VerifyOtpPage`, el socio ve un checkbox "Recordar este dispositivo por 30 días" desmarcado por defecto.
- [x] Si el socio marca el checkbox y el OTP es válido, el backend registra el dispositivo como confiable.
- [x] Si el socio no marca el checkbox, el flujo de login continúa sin registrar el dispositivo; el siguiente login desde ese dispositivo vuelve a pedir OTP.
- [x] En un login posterior desde un dispositivo ya registrado, el backend resuelve automáticamente el challenge de dispositivo sin involucrar al socio y retorna HTTP 200 con los tokens directamente desde `POST /v1/auth/login`.
- [x] Un identificador del dispositivo es almacenado localmente en el cliente tras el primer login con OTP exitoso y enviado en cada intento de login posterior (puede ser nulo si no existe).
- [x] Si el dispositivo fue registrado hace más de 30 días o ya no es reconocido, el flujo vuelve a pedir OTP de forma normal sin errores visibles para el socio.
- [x] Si el identificador de dispositivo no es reconocido (dispositivo inválido o expirado), el backend continúa el flujo normal de OTP sin exponer el error al socio.
- [x] Todos los errores relacionados con el flujo de dispositivo siguen el esquema estándar `{ status, error: { code, message } }` y son mapeados a mensajes amigables en español en el frontend.

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
- **Identificador de dispositivo en almacenamiento local:** El identificador del dispositivo puede almacenarse en `localStorage` porque no contiene información de sesión ni credenciales por sí solo.
- **Tokens de acceso NO en localStorage:** Los tokens de acceso e identidad deben almacenarse en memoria; solo el identificador de dispositivo puede ir en `localStorage`.
- **Transparencia ante el socio:** Si el dispositivo no es reconocido o expiró, el flujo vuelve a pedir OTP sin mensajes de error confusos; el socio simplemente ve la pantalla de verificación OTP de forma normal.
- **Sin llamadas directas al proveedor de identidad desde el frontend:** Toda la lógica de dispositivo se ejecuta en el backend.
- **Registro bajo demanda:** El dispositivo solo se registra como confiable cuando el socio lo solicita explícitamente marcando el checkbox.

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

- [x] Endpoint backend implementado y desplegado en dev.
- [x] Registro de dispositivo y resolución automática de challenge implementados en el backend.
- [x] Solo socios con sesión activa pueden marcar el checkbox de recordar dispositivo.
- [x] Pantalla de verificación OTP actualizada con checkbox "Recordar este dispositivo" y lógica de envío del identificador de dispositivo.
- [x] Frontend almacena el identificador de dispositivo localmente y lo envía en cada intento de login.
- [x] Errores del API mapeados a mensajes amigables en español.
- [x] Recurso Terraform `aws_cognito_user_pool` actualizado con `device_configuration`.
- [x] Tests unitarios escritos y pasando (flujo con dispositivo recordado, flujo sin checkbox, dispositivo expirado/inválido).
- [x] Probado manualmente en ambiente dev (primer login con checkbox, segundo login sin OTP, login tras 30 días).
- [x] Código revisado y aprobado.
- [x] Listo para despliegue.

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
