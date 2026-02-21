terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bootstrap uses a local backend intentionally — it creates the S3 bucket and
  # DynamoDB table that all other environments use as their remote backend.
  # This module is run ONCE per AWS account and must never be migrated to S3.
  backend "local" {}
}

provider "aws" {
  region = var.aws_region
}

# Resolve the AWS account ID at plan time so the S3 bucket name is globally unique.
data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# Terraform State Bucket
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "tf_state" {
  bucket = "${var.project}-tfstate-${data.aws_caller_identity.current.account_id}"

  # Prevent accidental deletion of the bucket that holds all Terraform state.
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project   = var.project
    ManagedBy = "terraform-bootstrap"
    Purpose   = "terraform-state"
  }
}

# Enable versioning so every state file write is preserved and recoverable.
resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Encrypt all state files at rest using AES-256 (SSE-S3, no extra cost).
resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access — state files must never be publicly readable.
resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# Terraform State Lock Table
# ---------------------------------------------------------------------------
# A single DynamoDB table with a "LockID" partition key is the Terraform
# convention for distributed state locking. PAY_PER_REQUEST keeps it free
# under normal usage (lock acquire + release per apply).
resource "aws_dynamodb_table" "tf_lock" {
  name         = "${var.project}-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # The lock table itself must not be accidentally destroyed.
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project   = var.project
    ManagedBy = "terraform-bootstrap"
    Purpose   = "terraform-state-lock"
  }
}
