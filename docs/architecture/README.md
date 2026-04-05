# Architecture Diagrams

This directory contains all system architecture diagrams for ActivaClub.
Each diagram is a standalone `.mmd` file (one diagram per file — required by Mermaid).

## Diagrams

| File | Description | Stories |
|------|-------------|---------|
| `architecture.mmd` | System Overview — C4 container-level graph (all actors, AWS services, integrations) | All |
| `02-registration-flow.mmd` | Registration + Email Verification sequence | AC-001, AC-002, AC-003, AC-004 |
| `03-login-otp-flow.mmd` | Login + OTP MFA sequence | AC-005, AC-006 |
| `04-logout-flow.mmd` | Logout + token revocation sequence | AC-008 |
| `05-role-redirect-flow.mmd` | Post-login role redirect + route guards | AC-009 |
| `06-remember-device-flow.mmd` | Remember device — skip OTP on trusted devices | AC-010 |
| `07-payments-flow.mmd` | Stripe checkout + webhook sequence | EP-04 |
| `08-promotions-flow.mmd` | SNS promotions broadcast sequence | EP-05 |

## How to render

- **VS Code**: Install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) or [Mermaid Editor](https://marketplace.visualstudio.com/items?itemName=tomoyukim.vscode-mermaid-editor) extension. Open any `.mmd` file and press `Ctrl+Shift+P → Mermaid: Preview`.
- **Online**: Paste any diagram into [mermaid.live](https://mermaid.live).
- **Important**: Each `.mmd` file contains exactly one diagram. Mermaid does not support multiple diagram types in a single file.

## Draw.io Diagram

`architecture.drawio` is the visual version of `architecture.mmd` (Diagram 1) for presentations.
To update it: open [draw.io](https://draw.io) or the VS Code Draw.io extension and import the AWS shape library.
