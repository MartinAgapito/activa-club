# Documentación — ActivaClub

Documentación técnica de la plataforma ActivaClub.

## Estructura

```
docs/
├── architecture/       # Diagramas de arquitectura del sistema
│   ├── architecture.mmd          # Diagrama 1: Overview general (C4-style, graph TB)
│   ├── 02-registration-flow.mmd  # Diagrama 2: Registro + verificación de email
│   ├── 03-login-otp-flow.mmd     # Diagrama 3: Login + OTP MFA
│   ├── 04-logout-flow.mmd        # Diagrama 4: Logout + revocación de tokens
│   ├── 05-role-redirect-flow.mmd # Diagrama 5: Redirección post-login por rol
│   ├── 06-remember-device-flow.mmd # Diagrama 6: Recordar dispositivo
│   ├── 07-payments-flow.mmd      # Diagrama 7: Pagos Stripe + webhook
│   ├── 08-promotions-flow.mmd    # Diagrama 8: Difusión SNS de promociones
│   └── architecture.drawio       # Versión Draw.io del diagrama 1
├── design/             # Documentos de diseño técnico por historia (AC-XXX-design.md)
└── api/                # Especificaciones OpenAPI (si se mantienen por separado del código)
```

## Convención de Documentos de Diseño

Cada historia `AC-XXX` que involucra cambios de código tiene un documento de diseño correspondiente:
- Ruta: `docs/design/AC-XXX-design.md`
- Secciones: Overview, API Contract, DynamoDB Changes, Lambda Design, Security Considerations

## Documentos de Arquitectura

- `architecture/architecture.mmd` — Diagrama 1: overview del sistema (usar este para el README principal)
- `architecture/0N-*.mmd` — Diagramas de flujo individuales por épica/historia
- `architecture/architecture.drawio` — Versión Draw.io para presentaciones/exportación

**Importante:** Cada archivo `.mmd` contiene exactamente un diagrama. Mermaid no soporta múltiples tipos de diagrama en un solo archivo.
