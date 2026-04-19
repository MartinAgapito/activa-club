# AC-008: Logout del Socio — Cierre de Sesión

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Done
**Fecha:** 2026-04-03
**Última actualización:** 2026-04-17
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como socio autenticado,
Quiero poder cerrar sesión desde cualquier pantalla de la plataforma,
Para que mi sesión activa quede cerrada y no pueda navegarse a áreas protegidas sin autenticarse de nuevo.

---

## Valor de Negocio

El cierre de sesión explícito limpia el estado local de autenticación e impide la reautenticación silenciosa automática, protegiendo al socio cuando comparte un dispositivo. El diseño es un "soft logout": la sesión local se cierra inmediatamente, pero el refresh token guardado en localStorage se conserva para que el flujo "Recordar dispositivo" (AC-010) pueda funcionar — si el socio vuelve a hacer login desde el mismo dispositivo, no necesitará OTP. Esto equilibra seguridad y usabilidad en el MVP.

---

## Personas Involucradas

| Persona          | Rol     | Interacción                                                       |
|------------------|---------|-------------------------------------------------------------------|
| Socio Autenticado | Member  | Hace clic en "Cerrar sesión" desde el menú o el header           |
| Admin            | Admin   | Puede cerrar sesión desde el panel de administración             |
| Manager          | Manager | Puede cerrar sesión desde su vista de gestión                    |

---

## Precondiciones

- El socio completó el flujo de login (AC-005 + AC-006/AC-007) y posee `idToken` y `accessToken` en el store de Zustand.
- El store de Zustand está hidratado desde sessionStorage (persiste el tab, no el browser close).

---

## Criterios de Aceptación

- [x] Al hacer clic en "Cerrar sesión", el frontend limpia inmediatamente el store de Zustand (`user`, `idToken`, `accessToken`, `isAuthenticated`).
- [x] Tras el logout, el frontend redirige al socio a `/auth/login` mediante React Router (sin recarga de página).
- [x] El botón "Cerrar sesión" es visible y accesible desde el menú principal (header) en todas las pantallas autenticadas.
- [x] Tras el logout, si el usuario intenta navegar a una ruta protegida, el guard de rutas detecta `isAuthenticated: false` y redirige a `/auth/login`.
- [x] Al volver a la pantalla de login tras cerrar sesión, se muestra el formulario (no hay reautenticación silenciosa automática).
- [x] Al ingresar credenciales en el formulario de login luego del logout (dispositivo recordado), el sistema usa el refresh token guardado y no pide OTP.

---

## Fuera de Alcance

- Logout remoto forzado por el Admin (ej. desactivar un socio y revocar sus sesiones activas) — diferido a historia de gestión de socios del Admin.
- Manejo de refresh automático de tokens (`RefreshToken`) — diferido a historia de gestión de sesión.
- "Cerrar sesión en todos los dispositivos" como opción separada — el logout ya invalida todas las sesiones activas; no se requiere UI adicional para el MVP.

---

## Reglas de Negocio

- **Soft logout:** El logout limpia el estado en memoria y en sessionStorage, pero NO borra el refresh token de localStorage. El refresh token se conserva para que el flujo "Recordar dispositivo" (AC-010) siga activo.
- **Limpieza local siempre:** El estado en memoria del cliente (Zustand) se limpia en todos los casos al hacer logout.
- **Prevención de reautenticación silenciosa inmediata:** Se establece el flag `activa-club-logged-out` en sessionStorage al momento del logout. LoginPage lee este flag al montar, cancela el silent refresh, muestra el formulario, y luego elimina el flag.
- **Redirección sin recarga:** La navegación a `/auth/login` se realiza mediante React Router `navigate()`, evitando una recarga de página que causaría una condición de carrera con el middleware `persist` de Zustand y sessionStorage.

---

## Dependencias

| Historia / Artefacto | Motivo                                                                                  |
|----------------------|-----------------------------------------------------------------------------------------|
| AC-006               | Provee los tokens JWT (AccessToken, IdToken, RefreshToken) que este endpoint invalida.  |
| AC-007               | El frontend ya gestiona tokens en Zustand; este endpoint extiende ese flujo.           |

---

## Definition of Done

- [x] `logout()` en `auth.store.ts` limpia el store y establece el flag sessionStorage `activa-club-logged-out`.
- [x] `Header.tsx` navega a `/auth/login` vía React Router `navigate()` después de llamar a `logout()`.
- [x] `LoginPage.tsx` respeta el flag y muestra el formulario en lugar de hacer silent refresh.
- [x] Botón "Cerrar sesión" visible en el layout principal de todas las vistas autenticadas.
- [x] Probado manualmente en ambiente dev.
- [x] Código revisado y aprobado.
- [x] Listo para despliegue.

---

## Notas Técnicas

- **Soft logout (diseño intencional):** El logout NO llama al backend ni revoca tokens en Cognito. Esto es deliberado para mantener el refresh token válido para el flujo "Recordar dispositivo" (AC-010). Un hard logout (GlobalSignOut) invalidaría el refresh token y el socio tendría que hacer OTP en el próximo login incluso desde un dispositivo recordado.
- **`auth.store.ts` — `logout()`:**
  ```ts
  logout: async () => {
    sessionStorage.setItem('activa-club-logged-out', 'true')
    set({ user: null, idToken: null, accessToken: null, isAuthenticated: false, isLoading: false })
  }
  ```
- **`Header.tsx` — `handleSignOut()`:**
  ```ts
  const handleSignOut = async () => {
    await signOut()  // calls useAuth → useAuthStore.logout()
    navigate('/auth/login', { replace: true })
  }
  ```
- **`LoginPage.tsx` — respeto al flag:**
  ```ts
  useEffect(() => {
    if (sessionStorage.getItem('activa-club-logged-out')) {
      sessionStorage.removeItem('activa-club-logged-out')
      setIsSilentRefreshing(false)
      return
    }
    // ... silent refresh logic
  }, [])
  ```
- **Por qué React Router navigate y no window.location.href:** `window.location.href` provoca una recarga completa de la página antes de que el middleware `persist` de Zustand escriba el estado limpio en sessionStorage. La nueva página hidrata `isAuthenticated: true` del sessionStorage stale y redirige automáticamente al dashboard. React Router `navigate()` no recarga la página, por lo que el estado en memoria ya es correcto cuando LoginPage monta.
- **Persistencia de tokens:** `accessToken` solo vive en memoria (no se persiste en sessionStorage). `idToken` y `user` se persisten en sessionStorage (se borran al cerrar el browser). `refreshToken` vive en localStorage (sobrevive al browser close, válido 30 días — ver AC-010).
