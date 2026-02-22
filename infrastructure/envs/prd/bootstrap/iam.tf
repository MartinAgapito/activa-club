# ============================================================
# prd/bootstrap/iam.tf
#
# IAM Role for GitHub Actions to run Terraform against the
# PRD environment via OIDC — no static access keys required.
#
# Design:
#   - The role is assumed via OIDC (no static access keys).
#   - The trust policy is restricted to tags matching prd-v*
#     so only release tags can trigger PRD deployments.
#   - AdministratorAccess is attached temporarily for POC.
#     Scope this down to least-privilege before going live.
# ============================================================

# ------------------------------------------------------------
# IAM Role — assumed by GitHub Actions via OIDC (PRD account)
# ------------------------------------------------------------
resource "aws_iam_role" "terraform_prd" {
  name        = "activa-club-terraform-prd-role"
  description = "Role assumed by GitHub Actions to run Terraform for the ActivaClub PRD environment"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowGitHubActionsOIDC"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            # Restricted to tags matching prd-v* — branch pushes and PRs
            # cannot assume this role, only release tags can.
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/tags/prd-v*"
            # Restrict audience to AWS STS
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Project     = "activa-club"
    Environment = var.env
    ManagedBy   = "terraform-bootstrap"
  }
}

# ------------------------------------------------------------
# Attach AdministratorAccess to the Terraform PRD role
#
# Temporary for POC — scope down to least-privilege before
# promoting this configuration to a production workload.
# ------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "terraform_prd_admin" {
  role       = aws_iam_role.terraform_prd.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
