# ============================================================
# dev/bootstrap/iam.tf
#
# IAM Role for GitHub Actions to run Terraform against the
# DEV environment via OIDC — no static access keys required.
#
# Design:
#   - The role is assumed via OIDC (no static access keys).
#   - The trust policy is scoped to the ActivaClub repository
#     using a wildcard on the sub claim so both branch pushes
#     and pull-request workflows can assume it.
#   - AdministratorAccess is attached because the DEV Terraform
#     configuration provisions arbitrary resources and the scope
#     is intentionally broad for development iteration speed.
#     Scope this down before promoting patterns to production.
# ============================================================

# ------------------------------------------------------------
# IAM Role — assumed by GitHub Actions via OIDC (DEV account)
# ------------------------------------------------------------
resource "aws_iam_role" "terraform_dev" {
  name        = var.dev_role_name
  description = "Role assumed by GitHub Actions to run Terraform for the ActivaClub DEV environment"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowGitHubActionsOIDC"
        Effect = "Allow"
        Principal = {
          # ARN of the OIDC provider created in main.tf
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            # Restrict to the correct GitHub repository.
            # Wildcard on ref allows main branch, PRs, and feature branches.
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
            # Restrict audience to AWS STS
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Project     = "activa-club"
    Environment = "dev"
    ManagedBy   = "terraform-bootstrap"
  }
}

# ------------------------------------------------------------
# Attach AdministratorAccess to the Terraform DEV role
#
# Rationale: the DEV environment is used for rapid iteration
# and may provision any supported AWS service. A least-privilege
# policy would need to be updated on every new resource type.
# This is acceptable for a non-production account. Revisit if
# the DEV account is shared with other workloads.
# ------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "terraform_dev_admin" {
  role       = aws_iam_role.terraform_dev.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
