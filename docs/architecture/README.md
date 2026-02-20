# Architecture Diagrams

This directory contains all system architecture diagrams for ActivaClub.

## Files

| File                  | Format   | Contents                                              |
|-----------------------|----------|-------------------------------------------------------|
| `architecture.mmd`    | Mermaid  | Four diagrams: system overview, auth flow, Stripe webhook flow, SNS broadcast flow |
| `architecture.drawio` | Draw.io  | Visual diagram for presentations (see instructions below) |

## Mermaid Diagrams (architecture.mmd)

Four diagrams are defined in sequence:
1. **System Overview** - C4 container-level graph showing all actors, AWS services, and external integrations
2. **Authentication Flow** - Sequence diagram for DNI onboarding + Cognito sign-up/sign-in
3. **Stripe Payment Flow** - Sequence diagram for checkout session creation and webhook processing
4. **SNS Promotions Broadcast** - Sequence diagram for promotion creation and fan-out to members

To render locally: use the [Mermaid Live Editor](https://mermaid.live) or the Mermaid extension in VS Code.

## Draw.io Diagram (architecture.drawio)

To create the Draw.io version:
1. Open [draw.io](https://draw.io) (or the VS Code Draw.io extension)
2. Create a new diagram
3. Import the following component categories from AWS shape library:
   - Users (Admin, Manager, Member actors)
   - CloudFront + S3 (frontend delivery)
   - API Gateway (HTTP API)
   - Lambda (7 functions)
   - DynamoDB (6 tables)
   - Cognito (User Pool)
   - SNS (2 topics)
   - Stripe (external service box)
4. Arrange following the layout in `architecture.mmd` Diagram 1
5. Save as `architecture.drawio` in this directory
