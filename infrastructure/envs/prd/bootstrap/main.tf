# ============================================================
# bootstrap/main.tf
#
# Run ONCE per AWS account to create the foundational resources
# that all other Terraform configurations depend on:
#   - S3 bucket for remote state storage
#   - DynamoDB table for state locking
#   - GitHub Actions OIDC provider
#
# Uses a LOCAL backend intentionally — this state file is
# committed to the repo so the team can inspect it, but it
# is never used for drift detection after the first apply.
# ============================================================

terraform {
  required_version = ">= 1.6"

  # Local backend — bootstrap is run once and the resulting
  # resources are the prerequisites for the S3 remote backend
  # used everywhere else.
  backend "local" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ------------------------------------------------------------
# S3 bucket — Terraform remote state storage
# Versioning is enabled so previous state files can be recovered.
# ------------------------------------------------------------
resource "aws_s3_bucket" "tf_state" {
  bucket = var.state_bucket_name

  # Prevent accidental deletion of the bucket that holds all state
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "activa-club"
    Environment = var.env
    ManagedBy   = "terraform-bootstrap"
    Description = "Terraform remote state storage"
  }
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  rule {
    apply_server_side_encryption_by_default {
      # AES256 (SSE-S3) is free and sufficient for state files
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ------------------------------------------------------------
# DynamoDB table — Terraform state locking
# Prevents concurrent applies from corrupting the state file.
# PAY_PER_REQUEST keeps costs at zero when not actively running.
# ------------------------------------------------------------
resource "aws_dynamodb_table" "tf_lock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Server-side encryption using AWS-owned key (free)
  server_side_encryption {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "activa-club"
    Environment = var.env
    ManagedBy   = "terraform-bootstrap"
    Description = "Terraform state lock table"
  }
}

# ------------------------------------------------------------
# GitHub Actions OIDC Provider
# Allows GitHub Actions to assume AWS IAM roles without static
# credentials, using short-lived tokens instead.
# Two thumbprints are listed to survive GitHub's TLS rotation.
# ------------------------------------------------------------
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  # sts.amazonaws.com is the audience GitHub Actions uses
  client_id_list = ["sts.amazonaws.com"]

  # Thumbprints of the GitHub Actions OIDC TLS certificate chain.
  # Two values provided to avoid downtime if GitHub rotates its cert.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  tags = {
    Project     = "activa-club"
    Environment = var.env
    ManagedBy   = "terraform-bootstrap"
  }
}
