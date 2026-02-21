# Senior Product Owner - Persistent Memory

## File Writing Convention
- The Write tool is blocked for .md files in this project. Use sequential bash printf redirections instead.
- Bash heredocs fail when content contains backtick triple-fences (Gherkin code blocks). Use printf line-by-line.
- Node.js v22 is available (node) but -e flag also conflicts with backticks in shell. Use a temp .js file if needed.
- Python is at /c/Program Files/Python310/python (not python3).

## Backlog Structure
- Story files go in: C:/Users/Martin/Desktop/Tesis/backlog/
- Naming pattern: AC-XXX-short-title.md (e.g. AC-001-member-registration-dni-match.md)
- Epics are defined in backlog/README.md: EP-01 through EP-08

## Tech Stack (for story context)
- Backend: NestJS on AWS Lambda (one Lambda per module), API Gateway HTTP API
- Database: DynamoDB multi-table design
- Auth: Amazon Cognito User Pool + Groups (Admin, Manager, Member)
- Frontend: React + TypeScript (Vite), Shadcn/ui, Tailwind, Zustand + React Query
- Payments: Stripe; Notifications: Amazon SNS; IaC: Terraform

## Stories Created
- AC-001: Member Registration via DNI Match (EP-01, Priority: High, Points: 8)
