# AC-007: Frontend — Flujo Completo de Autenticación

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 5
**Estado:** Done
**Fecha:** 2026-03-29
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio,
Quiero una interfaz web intuitiva para registrarme, verificar mi email e iniciar sesión con doble factor,
Para acceder al sistema desde cualquier dispositivo de forma segura y sin fricciones.

---

## Valor de Negocio

La interfaz de autenticación es el primer punto de contacto del socio con la plataforma.
Una experiencia fluida, con mensajes de error claros en español, campos de contraseña con visibilidad
controlada y diseño responsive, reduce el abandono en el proceso de onboarding y transmite confianza
en el sistema.

---

## Personas Involucradas

| Persona              | Rol    | Interacción                                                              |
|----------------------|--------|--------------------------------------------------------------------------|
| Socio Potencial      | Member | Utiliza las pantallas de registro y verificación de email                |
| Socio Registrado     | Member | Utiliza las pantallas de login y verificación OTP                        |

---

## Precondiciones

- AC-002 a AC-006 completados: todos los endpoints del flujo de autenticación están disponibles y desplegados en dev.
- El ambiente de AWS dev es accesible desde el frontend local.

---

## Criterios de Aceptación

- [x] `RegisterPage` conectada a `POST /v1/auth/register` con formulario que incluye DNI, email y contraseña.
- [x] `VerifyEmailPage` conectada a `POST /v1/auth/verify-email`; al cargar la página extrae `email` y `token` de los query params del link recibido por email y dispara la confirmación automáticamente. Incluye opción "Reenviar link" conectada a `POST /v1/auth/resend-code`.
- [x] `LoginPage` conectada a `POST /v1/auth/login` con formulario de email y contraseña.
- [x] `VerifyOtpPage` conectada a `POST /v1/auth/verify-otp` con campo de código OTP de 6 dígitos.
- [x] Todos los formularios tienen validación en tiempo real implementada con React Hook Form + Zod.
- [x] Los errores del API son mapeados a mensajes amigables en español (no se exponen códigos técnicos al usuario).
- [x] Tras login exitoso, los tokens se almacenan correctamente y el socio es redirigido al dashboard.
- [x] El diseño es responsive (Tailwind + Shadcn/ui) y funciona en dispositivos móviles y de escritorio.
- [x] El flujo completo (registro → clic en link de verificación → login → verificación OTP → dashboard) funciona end-to-end contra el ambiente dev de AWS.
- [x] Todos los campos de tipo contraseña incluyen un toggle de visibilidad (mostrar/ocultar): un ícono de ojo posicionado a la derecha del campo; al hacer clic muestra la contraseña en texto plano, al volver a hacer clic la oculta. El componente es reutilizable y se aplica a todos los campos de contraseña del flujo.

---

## Fuera de Alcance

- Pantalla de recuperación de contraseña — diferida a historia futura.
- Login con redes sociales — no forma parte del MVP.
- Pantalla de perfil del socio — cubierta en historia de gestión de perfil.

---

## Reglas de Negocio

- **Sin llamadas directas a Cognito desde el frontend:** Todas las operaciones de autenticación se realizan a través de los endpoints REST del backend.
- **Almacenamiento seguro de tokens:** El `accessToken` se almacena solo en memoria (Zustand, no persiste). El `idToken` y `user` se persisten en `sessionStorage` (se limpian al cerrar el browser). El `refreshToken` puede guardarse en `localStorage` solo si el socio marcó explícitamente "Recordar este dispositivo" (ver AC-010); en ese caso su presencia en localStorage es intencional y esperada.
- **Mensajes en español:** Todos los mensajes visibles para el usuario deben estar en español, independientemente del código de error del API.
- **Toggle de visibilidad de contraseña reutilizable:** El toggle debe implementarse como un componente único y no como lógica duplicada en cada formulario.
- **Verificación por link:** La pantalla de verificación de email no muestra un formulario de ingreso de código; en cambio, procesa automáticamente el link al cargar, confirmando la cuenta sin intervención manual del socio.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                            |
|----------------------|-----------------------------------------------------------------------------------|
| AC-002               | `RegisterPage` consume este endpoint.                                             |
| AC-003               | `VerifyEmailPage` consume este endpoint; procesa el link con `email` y `token`.   |
| AC-004               | `VerifyEmailPage` consume este endpoint para el reenvío del link.                 |
| AC-005               | `LoginPage` consume este endpoint.                                                |
| AC-006               | `VerifyOtpPage` consume este endpoint.                                            |

---

## Definition of Done

- [x] `RegisterPage` implementada y conectada al API.
- [x] `VerifyEmailPage` implementada: procesa query params del link automáticamente y ofrece reenvío.
- [x] `LoginPage` implementada y conectada al API.
- [x] `VerifyOtpPage` implementada y conectada al API.
- [x] Componente `PasswordInput` implementado con toggle Eye/EyeOff (lucide-react) y aplicado en todos los campos de contraseña.
- [x] Validación en tiempo real con React Hook Form + Zod en todos los formularios.
- [x] Errores del API mapeados a mensajes amigables en español.
- [x] Flujo completo end-to-end probado manualmente contra ambiente dev de AWS.
- [x] Diseño responsive verificado en móvil y escritorio.
- [x] Código revisado y aprobado (PR mergeado a main).

---

## Notas Técnicas

- **Stack:** React + TypeScript + Vite.
- **State management:** Zustand.
- **HTTP client:** React Query + axios.
- **UI:** Tailwind CSS + Shadcn/ui.
- **Validación de formularios:** React Hook Form + Zod.
- **Íconos:** lucide-react (`Eye`, `EyeOff`) para el componente `PasswordInput`.
- **Design Docs:** `docs/design/AC-001-design.md`, `docs/design/AC-002-design.md`
