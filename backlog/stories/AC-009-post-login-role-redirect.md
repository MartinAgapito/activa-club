# AC-009: Redirección Post-Login Según Rol

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 2
**Estado:** Done
**Fecha:** 2026-04-03
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como usuario autenticado (socio, manager o administrador),
Quiero ser redirigido automáticamente al dashboard correspondiente a mi rol tras completar el login,
Para acceder directamente a las funcionalidades relevantes para mi perfil sin navegación manual adicional.

---

## Valor de Negocio

El sistema tiene tres roles con interfaces y responsabilidades distintas. Redirigir a todos los usuarios a `/member/dashboard` genera confusión y errores de acceso: un Admin que llega a la vista del socio no tiene acceso a las herramientas de gestión que necesita. La redirección por rol es un requisito funcional básico del RBAC y garantiza que cada usuario llegue al contexto correcto desde el primer segundo post-autenticación.

---

## Personas Involucradas

| Persona   | Rol     | Interacción                                                                |
|-----------|---------|----------------------------------------------------------------------------|
| Socio     | Member  | Tras el login exitoso, es redirigido a `/member/dashboard`                |
| Manager   | Manager | Tras el login exitoso, es redirigido a `/admin/dashboard` (vista Manager) |
| Admin     | Admin   | Tras el login exitoso, es redirigido a `/admin/dashboard`                 |

---

## Precondiciones

- AC-006 completado: el backend emite `IdToken` que contiene el claim `cognito:groups` con el o los grupos del usuario.
- AC-007 completado: el frontend almacena el `IdToken` en el store de Zustand y puede decodificarlo (sin verificación criptográfica en cliente — solo lectura de payload).
- Los usuarios están asignados al grupo correspondiente en el Cognito User Pool: `Admin`, `Manager` o `Member`.

---

## Criterios de Aceptación

- [x] Tras el login exitoso, el frontend resuelve el rol del usuario a partir del token de identidad y redirige sin llamada adicional al backend.
- [x] Usuario con rol `Admin` → redirigir a `/admin/dashboard`.
- [x] Usuario con rol `Manager` → redirigir a `/admin/dashboard`.
- [x] Usuario con rol `Member` (o rol no reconocido) → redirigir a `/member/dashboard`.
- [x] Si un usuario pertenece a múltiples roles, se aplica el de mayor precedencia: Admin > Manager > Member.
- [x] Si el rol no puede determinarse, el frontend redirige a `/member/dashboard` como fallback seguro y registra un warning en consola.
- [x] Las rutas protegidas implementan guardas de rol: si un usuario intenta acceder a una ruta de un rol superior al suyo (ej. un `Member` accede a `/admin/dashboard`), es redirigido a su propio dashboard.
- [x] La redirección es inmediata (sin pantalla intermedia de carga visible al usuario).

---

## Fuera de Alcance

- Implementación completa de `/admin/dashboard` y `/member/dashboard` — cubiertas en historias de Admin Dashboard (EP-06) y Member Dashboard (futuro epic).
- Lógica de permisos a nivel de endpoint backend — el RBAC en el API ya está implementado via Cognito Authorizer en API Gateway.
- Soporte para roles personalizados o jerarquías adicionales más allá de Admin, Manager y Member — no forma parte del MVP.

---

## Reglas de Negocio

- **Fuente de verdad del rol:** El rol del usuario se resuelve a partir del token de identidad emitido en el login. No se requiere llamada adicional al backend.
- **Jerarquía de precedencia:** Admin > Manager > Member. Si el usuario pertenece a múltiples roles, se aplica el de mayor precedencia.
- **Fallback seguro:** En caso de ambigüedad o error al leer el rol, el usuario cae a `/member/dashboard`. Nunca se debe elevar el acceso por error.
- **Guardas de ruta (Route Guards):** Cada ruta protegida verifica que el rol del usuario sea compatible. Un `Member` nunca puede acceder a rutas de `Admin` o `Manager`, incluso navegando manualmente a la URL.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                              |
|----------------------|-----------------------------------------------------------------------------------------------------|
| AC-006               | Emite el `IdToken` con el claim `cognito:groups` que determina el rol del usuario.                 |
| AC-007               | El store de Zustand almacena el `IdToken`; la acción de redirect se dispara desde `VerifyOtpPage`. |
| AC-008               | El logout debe limpiar el rol del store; la guarda de ruta debe reevaluar tras el logout.          |

---

## Definition of Done

- [x] Resolución de rol implementada como utilidad reutilizable en el frontend.
- [x] El estado de sesión almacena el rol resuelto del usuario junto con los tokens.
- [x] Tras el login exitoso, el usuario es redirigido al dashboard correspondiente a su rol.
- [x] Guardas de ruta implementadas; redirigen a usuarios sin permisos suficientes a su propio dashboard.
- [x] La guarda de ruta está aplicada en: `/admin/dashboard` (requiere Admin o Manager), `/member/dashboard` (requiere Member).
- [x] Caso de múltiples grupos cubierto: Admin tiene precedencia sobre Manager y Member.
- [x] Fallback a `/member/dashboard` implementado para claims ausentes o inesperados.
- [x] Tests unitarios cubren: redirect a Admin, redirect a Manager, redirect a Member, multi-grupo con Admin, fallback por claim ausente.
- [x] Guardas de ruta probadas manualmente: Member no puede acceder a `/admin/dashboard`.
- [x] Probado end-to-end en ambiente dev con usuarios de los tres roles.
- [x] Código revisado y aprobado.
- [x] Listo para despliegue.

---

## Notas Técnicas

- **Decodificación del IdToken:** El payload del JWT es Base64url. En el frontend puede decodificarse con `JSON.parse(atob(idToken.split(".")[1]))`. No se requiere librería adicional para este caso de uso.
- **Claim objetivo:** `cognito:groups` es un array de strings en el payload del `IdToken` de Cognito. Ejemplo: `["Admin"]`, `["Member"]`, `["Admin", "Manager"]`.
- **Zustand:** Agregar campo `role` al slice de autenticación. El rol se resuelve una vez tras el login y se persiste en memoria durante la sesión.
- **React Router:** Implementar `PrivateRoute` como wrapper que lee el `role` del store de Zustand y aplica la lógica de redirección. Todas las rutas protegidas deben envolverse con este componente.
- **Design Doc:** `docs/design/AC-009-design.md` (a crear por el Arquitecto).
