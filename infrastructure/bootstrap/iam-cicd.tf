# ============================================================
# bootstrap/iam-cicd.tf
#
# IAM Role and Policy for GitHub Actions CI/CD pipeline.
#
# Design:
#   - The role is assumed via OIDC (no static access keys).
#   - The trust policy is scoped to a single GitHub repository
#     using a wildcard on the sub claim so both branch pushes
#     and pull-request workflows can assume it.
#   - The attached policy follows least privilege: only the
#     AWS actions that Terraform actually needs to plan/apply
#     the application infrastructure are granted.
# ============================================================

# ------------------------------------------------------------
# Data source — OIDC provider ARN (created in main.tf)
# ------------------------------------------------------------
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  depends_on = [aws_iam_openid_connect_provider.github_actions]
}

# ------------------------------------------------------------
# IAM Role — assumed by GitHub Actions via OIDC
# ------------------------------------------------------------
resource "aws_iam_role" "cicd" {
  name        = "activa-club-cicd-role"
  description = "Role assumed by GitHub Actions to deploy ActivaClub infrastructure via Terraform"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowGitHubActionsOIDC"
        Effect = "Allow"
        Principal = {
          # Use the ARN of the OIDC provider we just created
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            # Restrict to the correct GitHub repository.
            # Wildcard on ref allows main branch, PRs, and other branches.
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
            # Restrict audience to AWS STS
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Project   = "activa-club"
    ManagedBy = "terraform-bootstrap"
  }
}

# ------------------------------------------------------------
# IAM Policy — least-privilege permissions for Terraform
#
# Sections:
#   1. S3   — read/write state to the tfstate bucket only
#   2. DynamoDB (lock table) — acquire/release Terraform locks
#   3. DynamoDB (application) — manage application tables
#   4. Cognito  — manage user pools for ActivaClub
#   5. IAM read — Terraform needs to read roles/policies it manages
#   6. CloudWatch Logs — Lambda log group management
# ------------------------------------------------------------
resource "aws_iam_policy" "cicd_terraform" {
  name        = "activa-club-cicd-terraform-policy"
  description = "Minimum permissions for GitHub Actions to run Terraform for ActivaClub"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [

      # ----------------------------------------------------------
      # 1. S3 — Terraform state bucket only
      # ----------------------------------------------------------
      {
        Sid    = "TerraformStateBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketVersioning",
          "s3:GetEncryptionConfiguration",
          "s3:GetBucketPublicAccessBlock",
          "s3:GetBucketLocation",
        ]
        Resource = [
          "arn:aws:s3:::activa-club-tfstate-${var.aws_account_id}",
          "arn:aws:s3:::activa-club-tfstate-${var.aws_account_id}/*",
        ]
      },

      # ----------------------------------------------------------
      # 2. DynamoDB — lock table only (state locking)
      # ----------------------------------------------------------
      {
        Sid    = "TerraformLockTableAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
        ]
        Resource = "arn:aws:dynamodb:us-east-1:${var.aws_account_id}:table/activa-club-tflock"
      },

      # ----------------------------------------------------------
      # 3. DynamoDB — application tables
      # All actions Terraform needs to create/update/delete tables.
      # ----------------------------------------------------------
      {
        Sid    = "TerraformDynamoDBApplicationTables"
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable",
          "dynamodb:DeleteTable",
          "dynamodb:DescribeTable",
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:TagResource",
          "dynamodb:UntagResource",
          "dynamodb:UpdateTable",
          "dynamodb:ListTagsOfResource",
        ]
        # Scoped to the ActivaClub application tables only
        Resource = [
          "arn:aws:dynamodb:us-east-1:${var.aws_account_id}:table/MembersTable-*",
          "arn:aws:dynamodb:us-east-1:${var.aws_account_id}:table/SeedMembersTable-*",
        ]
      },

      # ----------------------------------------------------------
      # 4. Cognito — manage the ActivaClub user pool
      # All actions Terraform's aws_cognito_user_pool* resources need.
      # ----------------------------------------------------------
      {
        Sid    = "TerraformCognitoManagement"
        Effect = "Allow"
        Action = [
          "cognito-idp:CreateUserPool",
          "cognito-idp:DeleteUserPool",
          "cognito-idp:DescribeUserPool",
          "cognito-idp:UpdateUserPool",
          "cognito-idp:CreateUserPoolClient",
          "cognito-idp:DeleteUserPoolClient",
          "cognito-idp:DescribeUserPoolClient",
          "cognito-idp:UpdateUserPoolClient",
          "cognito-idp:CreateUserPoolDomain",
          "cognito-idp:DeleteUserPoolDomain",
          "cognito-idp:DescribeUserPoolDomain",
          "cognito-idp:CreateGroup",
          "cognito-idp:DeleteGroup",
          "cognito-idp:GetGroup",
          "cognito-idp:UpdateGroup",
          "cognito-idp:ListUserPoolClients",
          "cognito-idp:GetUserPoolMfaConfig",
          "cognito-idp:SetUserPoolMfaConfig",
          "cognito-idp:TagResource",
          "cognito-idp:UntagResource",
          "cognito-idp:ListTagsForResource",
        ]
        Resource = "*"
      },

      # ----------------------------------------------------------
      # 5. IAM — read-only so Terraform can verify role/policy state
      # Write operations are intentionally excluded.
      # ----------------------------------------------------------
      {
        Sid    = "TerraformIAMReadOnly"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies",
          "iam:GetOpenIDConnectProvider",
          "iam:ListOpenIDConnectProviders",
        ]
        Resource = "*"
      },

      # ----------------------------------------------------------
      # 6. CloudWatch Logs — manage log groups for Lambda functions
      # ----------------------------------------------------------
      {
        Sid    = "TerraformCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:ListTagsLogGroup",
          "logs:TagLogGroup",
          "logs:UntagLogGroup",
          "logs:PutRetentionPolicy",
          "logs:DeleteRetentionPolicy",
        ]
        Resource = "arn:aws:logs:us-east-1:${var.aws_account_id}:log-group:/aws/lambda/activa-club-*"
      }
    ]
  })

  tags = {
    Project   = "activa-club"
    ManagedBy = "terraform-bootstrap"
  }
}

# ------------------------------------------------------------
# Attach the policy to the CI/CD role
# ------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "cicd_terraform" {
  role       = aws_iam_role.cicd.name
  policy_arn = aws_iam_policy.cicd_terraform.arn
}
