# AC-008: Logout del Socio — Cierre de Sesión con Revocación de Tokens

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Done
**Fecha:** 2026-04-03
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio autenticado,
Quiero poder cerrar sesión desde cualquier pantalla de la plataforma,
Para que mis tokens queden invalidados en el servidor y mi cuenta quede protegida incluso si otro usuario accede al dispositivo.

---

## Valor de Negocio

Sin un logout real, los tokens de Cognito permanecen válidos hasta su expiración natural (el `AccessToken` dura 1 hora por defecto), lo que expone la cuenta del socio si el dispositivo es compartido o robado. Revocar la sesión en Cognito garantiza que ningún token emitido en esa sesión pueda reutilizarse, cumpliendo con prácticas mínimas de seguridad en una plataforma con datos de pago y reservas.

---

## Personas Involucradas

| Persona          | Rol     | Interacción                                                       |
|------------------|---------|-------------------------------------------------------------------|
| Socio Autenticado | Member  | Hace clic en "Cerrar sesión" desde el menú o el header           |
| Admin            | Admin   | Puede cerrar sesión desde el panel de administración             |
| Manager          | Manager | Puede cerrar sesión desde su vista de gestión                    |

---

## Precondiciones

- El socio completó el flujo de login (AC-005 + AC-006) y posee un `AccessToken` válido almacenado en el store de Zustand.
- El endpoint `POST /v1/auth/logout` requiere el `AccessToken` en el header `Authorization: Bearer <token>`.

---

## Criterios de Aceptación

- [x] Al hacer clic en "Cerrar sesión", el frontend llama a `POST /v1/auth/logout` enviando el `AccessToken` en el header `Authorization`.
- [x] El backend invalida todos los tokens activos de la cuenta del socio (no solo la sesión actual).
- [x] Tras el logout exitoso, el frontend limpia el estado local (tokens, datos del usuario) y redirige al socio a `/login`.
- [x] Si el `AccessToken` ya está expirado al momento del logout (caso edge), el backend retorna HTTP 401 y el frontend de todas formas limpia el store local y redirige a `/login`.
- [x] Si la llamada al backend falla por error de red, el frontend muestra un mensaje de error en español y mantiene la sesión activa (no limpia el store).
- [x] El botón "Cerrar sesión" es visible y accesible desde el menú principal (header o sidebar) en todas las pantallas autenticadas.
- [x] Tras el logout, si el usuario intenta navegar a una ruta protegida con los tokens invalidados, la petición es rechazada (HTTP 401) y el frontend redirige a `/login`.
- [x] La respuesta exitosa del endpoint es HTTP 200 con body `{ message: "Sesión cerrada correctamente" }`.
- [x] Todos los errores del endpoint siguen el esquema estándar `{ status, error: { code, message } }`.

---

## Fuera de Alcance

- Logout remoto forzado por el Admin (ej. desactivar un socio y revocar sus sesiones activas) — diferido a historia de gestión de socios del Admin.
- Manejo de refresh automático de tokens (`RefreshToken`) — diferido a historia de gestión de sesión.
- "Cerrar sesión en todos los dispositivos" como opción separada — el logout ya invalida todas las sesiones activas; no se requiere UI adicional para el MVP.

---

## Reglas de Negocio

- **Revocación global:** El logout invalida todos los tokens activos del usuario (no solo el de la sesión actual), garantizando que no existan sesiones paralelas activas tras el cierre de sesión.
- **Limpieza local siempre:** El estado local del cliente debe limpiarse en todos los casos: logout exitoso, token ya expirado (HTTP 401), o error no crítico. La única excepción es el error de red, donde el estado local se conserva.
- **Endpoint protegido:** El endpoint de logout requiere token de acceso válido en el header `Authorization`.
- **Sin estado en el servidor:** El backend no mantiene estado de sesión propio; la invalidación ocurre en el proveedor de identidad.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                  |
|----------------------|-----------------------------------------------------------------------------------------|
| AC-006               | Provee los tokens JWT (AccessToken, IdToken, RefreshToken) que este endpoint invalida.  |
| AC-007               | El frontend ya gestiona tokens en Zustand; este endpoint extiende ese flujo.           |

---

## Definition of Done

- [x] Endpoint `POST /v1/auth/logout` implementado y desplegado en dev.
- [x] Revocación global de tokens implementada correctamente en el backend.
- [x] El autorizador de API Gateway protege el endpoint (requiere `AccessToken` válido).
- [x] El frontend limpia el store de Zustand y redirige a `/login` tras logout exitoso.
- [x] El frontend maneja el caso de token expirado (HTTP 401) limpiando el store y redirigiendo a `/login`.
- [x] El frontend maneja el error de red mostrando mensaje en español sin limpiar el store.
- [x] Botón "Cerrar sesión" visible en el layout principal de todas las vistas autenticadas.
- [x] Tests unitarios del Lambda cubren: logout exitoso, token expirado, error de Cognito.
- [x] Probado manualmente en ambiente dev (verificar que el token queda invalidado intentando reutilizarlo).
- [x] Código revisado y aprobado.
- [x] Listo para despliegue.

---

## Notas Técnicas

- **Endpoint:** `POST /v1/auth/logout` — protegido, requiere `Authorization: Bearer <AccessToken>`.
- **Cognito API:** `AdminUserGlobalSignOut(userPoolId, username)` — invalida todos los refresh tokens activos del usuario. Los access tokens existentes siguen siendo técnicamente válidos hasta su TTL natural (1 hora), pero Cognito los marca como revocados para llamadas subsiguientes al User Pool.
- **Stack frontend:** Zustand store debe exponer una acción `logout()` que llame al endpoint y luego ejecute `reset()` o `clearAuth()` sobre el slice de autenticación.
- **Design Doc:** `docs/design/AC-008-design.md` (a crear por el Arquitecto).
