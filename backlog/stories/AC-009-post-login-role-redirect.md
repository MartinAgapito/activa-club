# AC-009: Redirección Post-Login Según Rol

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 2
**Estado:** Backlog
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

- [ ] Tras el OTP exitoso (`POST /v1/auth/verify-otp` responde HTTP 200), el frontend decodifica el `IdToken` y extrae el claim `cognito:groups`.
- [ ] Si `cognito:groups` contiene `Admin` → redirigir a `/admin/dashboard`.
- [ ] Si `cognito:groups` contiene `Manager` → redirigir a `/admin/dashboard`.
- [ ] Si `cognito:groups` contiene `Member` (o el claim está ausente) → redirigir a `/member/dashboard`.
- [ ] Si un usuario pertenece a múltiples grupos (ej. `Admin` y `Manager`), el rol `Admin` tiene precedencia sobre `Manager`, y `Manager` tiene precedencia sobre `Member`.
- [ ] La ruta de destino se determina en el cliente (frontend) usando el payload del `IdToken` almacenado en Zustand; no se requiere llamada adicional al backend para resolver el rol.
- [ ] Si el `IdToken` no puede decodificarse o el claim `cognito:groups` tiene un valor inesperado, el frontend redirige a `/member/dashboard` como fallback seguro y registra un warning en consola.
- [ ] Las rutas protegidas implementan guardas de rol (`PrivateRoute` o similar): si un usuario intenta acceder a una ruta de un rol superior al suyo (ej. un `Member` accede a `/admin/dashboard`), es redirigido a su dashboard correspondiente.
- [ ] La redirección es inmediata (sin pantalla intermedia de carga visible al usuario).

---

## Fuera de Alcance

- Implementación completa de `/admin/dashboard` y `/member/dashboard` — cubiertas en historias de Admin Dashboard (EP-06) y Member Dashboard (futuro epic).
- Lógica de permisos a nivel de endpoint backend — el RBAC en el API ya está implementado via Cognito Authorizer en API Gateway.
- Soporte para roles personalizados o jerarquías adicionales más allá de Admin, Manager y Member — no forma parte del MVP.

---

## Reglas de Negocio

- **Fuente de verdad del rol:** El claim `cognito:groups` del `IdToken` es la fuente de verdad del rol del usuario en el frontend. No se consulta ningún endpoint adicional para resolver el rol post-login.
- **Jerarquía de precedencia:** Admin > Manager > Member. Si el token contiene múltiples grupos, se aplica el de mayor precedencia.
- **Fallback seguro:** En caso de ambigüedad o error al leer el rol, el usuario cae a `/member/dashboard`. Nunca se debe elevar el acceso por error.
- **Guardas de ruta (Route Guards):** Cada ruta protegida debe verificar que el rol del usuario en Zustand sea compatible con la ruta que intenta acceder. Un `Member` nunca puede acceder a rutas de `Admin` o `Manager`, incluso navegando manualmente a la URL.
- **Sin verificación criptográfica en cliente:** La decodificación del `IdToken` en el frontend es solo para lectura de payload (Base64 decode). La verificación criptográfica real del token la realiza el autorizador de API Gateway en cada request al backend.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                              |
|----------------------|-----------------------------------------------------------------------------------------------------|
| AC-006               | Emite el `IdToken` con el claim `cognito:groups` que determina el rol del usuario.                 |
| AC-007               | El store de Zustand almacena el `IdToken`; la acción de redirect se dispara desde `VerifyOtpPage`. |
| AC-008               | El logout debe limpiar el rol del store; la guarda de ruta debe reevaluar tras el logout.          |

---

## Definition of Done

- [ ] La función de decodificación del `IdToken` (extracción de `cognito:groups`) está implementada como utilidad reutilizable en el frontend.
- [ ] El store de Zustand almacena el rol resuelto del usuario (ej. campo `role: "Admin" | "Manager" | "Member"`) junto con los tokens.
- [ ] `VerifyOtpPage` redirige al dashboard correcto según el rol extraído del `IdToken` tras el login exitoso.
- [ ] Componente `PrivateRoute` (o equivalente) implementado con validación de rol; redirige a usuarios sin permisos suficientes a su propio dashboard.
- [ ] La guarda de ruta está aplicada en: `/admin/dashboard` (requiere Admin o Manager), `/member/dashboard` (requiere Member).
- [ ] Caso de múltiples grupos cubierto: Admin tiene precedencia sobre Manager y Member.
- [ ] Fallback a `/member/dashboard` implementado para claims ausentes o inesperados.
- [ ] Tests unitarios cubren: redirect a Admin, redirect a Manager, redirect a Member, multi-grupo con Admin, fallback por claim ausente.
- [ ] Guardas de ruta probadas manualmente: Member no puede acceder a `/admin/dashboard`.
- [ ] Probado end-to-end en ambiente dev con usuarios de los tres roles.
- [ ] Código revisado y aprobado.
- [ ] Listo para despliegue.

---

## Notas Técnicas

- **Decodificación del IdToken:** El payload del JWT es Base64url. En el frontend puede decodificarse con `JSON.parse(atob(idToken.split(".")[1]))`. No se requiere librería adicional para este caso de uso.
- **Claim objetivo:** `cognito:groups` es un array de strings en el payload del `IdToken` de Cognito. Ejemplo: `["Admin"]`, `["Member"]`, `["Admin", "Manager"]`.
- **Zustand:** Agregar campo `role` al slice de autenticación. El rol se resuelve una vez tras el login y se persiste en memoria durante la sesión.
- **React Router:** Implementar `PrivateRoute` como wrapper que lee el `role` del store de Zustand y aplica la lógica de redirección. Todas las rutas protegidas deben envolverse con este componente.
- **Design Doc:** `docs/design/AC-009-design.md` (a crear por el Arquitecto).
