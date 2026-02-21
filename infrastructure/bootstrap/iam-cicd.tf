# ---------------------------------------------------------------------------
# GitHub Actions OIDC Provider
# ---------------------------------------------------------------------------
# Allows GitHub Actions to exchange a short-lived OIDC token for temporary
# AWS credentials via sts:AssumeRoleWithWebIdentity — no static keys needed.
#
# Thumbprint note: "6938fd4d98bab03faadb97b34396831e3780aea1" is the SHA-1
# thumbprint of the root CA that signs token.actions.githubusercontent.com
# as of 2024. If GitHub rotates their TLS certificate chain, this value must
# be updated. You can re-derive it with:
#   openssl s_client -connect token.actions.githubusercontent.com:443 \
#     -showcerts </dev/null 2>/dev/null \
#     | openssl x509 -fingerprint -noout -sha1 \
#     | tr -d ':' | cut -d= -f2 | tr 'A-F' 'a-f'
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
  ]

  tags = {
    Project   = var.project
    ManagedBy = "terraform-bootstrap"
  }
}

# ---------------------------------------------------------------------------
# Trust Policy — who can assume the CI/CD role
# ---------------------------------------------------------------------------
# The sub condition restricts assumption to workflows running on the main
# branch of the specified repository only. Wildcard refs (e.g., `ref:refs/heads/*`)
# should NOT be used in production to prevent topic-branch pipelines from
# assuming a production role.
data "aws_iam_policy_document" "github_oidc_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      # Format: repo:<ORG>/<REPO>:ref:refs/heads/main
      values = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

# ---------------------------------------------------------------------------
# CI/CD IAM Role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "cicd" {
  name               = "${var.project}-cicd-role"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume.json

  tags = {
    Project   = var.project
    ManagedBy = "terraform-bootstrap"
  }
}

# ---------------------------------------------------------------------------
# Least-Privilege CI/CD Policy
# ---------------------------------------------------------------------------
# This policy grants only the permissions Terraform needs to manage the
# production environment: S3 state backend, DynamoDB lock table, application
# DynamoDB tables, Cognito User Pool, and future Lambda IAM role pass-through.
data "aws_iam_policy_document" "cicd_terraform" {
  # ------------------------------------------------------------------
  # Terraform state bucket — read/write state files and list the bucket.
  # ------------------------------------------------------------------
  statement {
    sid    = "TerraformStateBucketObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = [
      "${aws_s3_bucket.tf_state.arn}/production/*",
    ]
  }

  statement {
    sid    = "TerraformStateBucketList"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.tf_state.arn,
    ]
  }

  # ------------------------------------------------------------------
  # Terraform state lock table — acquire, release, and check locks.
  # ------------------------------------------------------------------
  statement {
    sid    = "TerraformStateLock"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      aws_dynamodb_table.tf_lock.arn,
    ]
  }

  # ------------------------------------------------------------------
  # Application DynamoDB tables — full lifecycle for production tables.
  # Pattern: any table whose name ends with "Table-production".
  # ------------------------------------------------------------------
  statement {
    sid    = "ApplicationDynamoDBTables"
    effect = "Allow"
    actions = [
      "dynamodb:CreateTable",
      "dynamodb:DeleteTable",
      "dynamodb:DescribeTable",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
      "dynamodb:UpdateTable",
      "dynamodb:ListTagsOfResource",
    ]
    resources = [
      "arn:aws:dynamodb:*:*:table/*Table-production",
    ]
  }

  # ------------------------------------------------------------------
  # Cognito User Pool — full lifecycle for the production user pool.
  # ------------------------------------------------------------------
  statement {
    sid    = "CognitoUserPool"
    effect = "Allow"
    actions = [
      "cognito-idp:CreateUserPool",
      "cognito-idp:DeleteUserPool",
      "cognito-idp:DescribeUserPool",
      "cognito-idp:UpdateUserPool",
      "cognito-idp:CreateUserPoolClient",
      "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:CreateGroup",
      "cognito-idp:DeleteGroup",
      "cognito-idp:GetGroup",
      "cognito-idp:UpdateGroup",
      "cognito-idp:TagResource",
      "cognito-idp:UntagResource",
      "cognito-idp:ListTagsForResource",
    ]
    resources = [
      "arn:aws:cognito-idp:*:*:userpool/*",
    ]
  }

  # ------------------------------------------------------------------
  # IAM — allow Terraform to inspect and pass project-scoped roles.
  # Required when Terraform manages Lambda execution roles (future stories).
  # ------------------------------------------------------------------
  statement {
    sid    = "IamProjectRoles"
    effect = "Allow"
    actions = [
      "iam:GetRole",
      "iam:PassRole",
    ]
    resources = [
      "arn:aws:iam::*:role/activa-club-*",
    ]
  }
}

resource "aws_iam_policy" "cicd_terraform" {
  name        = "${var.project}-cicd-terraform-policy"
  description = "Least-privilege policy for GitHub Actions to run Terraform against the production environment."
  policy      = data.aws_iam_policy_document.cicd_terraform.json

  tags = {
    Project   = var.project
    ManagedBy = "terraform-bootstrap"
  }
}

resource "aws_iam_role_policy_attachment" "cicd_terraform" {
  role       = aws_iam_role.cicd.name
  policy_arn = aws_iam_policy.cicd_terraform.arn
}
