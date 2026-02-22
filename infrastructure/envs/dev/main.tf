# ============================================================
# dev/main.tf
#
# Development environment — wires together all infrastructure
# modules for ActivaClub against a separate AWS account.
#
# Remote state is stored in a dedicated S3 bucket and DynamoDB
# table that must be created manually before the first init
# (see README.md for the exact AWS CLI commands).
#
# The provider assumes a role in the DEV account so that no
# long-lived credentials are needed locally.
# ============================================================

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  # Assume a role in the DEV account.
  # The role must trust the identity running Terraform locally
  # (typically an IAM user or SSO session from the PRD account).
  assume_role {
    role_arn = "arn:aws:iam::${var.dev_account_id}:role/${var.dev_role_name}"
  }
}

# ============================================================
# DynamoDB — MembersTable
#
# Same schema as production but PITR is disabled to stay within
# the Free Tier. Data can be re-created from seed scripts.
# ============================================================
module "members_table" {
  source = "../../modules/dynamodb"

  table_name   = "MembersTable"
  env          = var.env
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"
  enable_pitr  = false

  # Declare every attribute used as a key or index key
  attributes = [
    { name = "PK", type = "S" },
    { name = "SK", type = "S" },
    { name = "GSI1PK", type = "S" },
    { name = "GSI1SK", type = "S" },
  ]

  # GSI1 mirrors the production index so queries work identically
  # in both environments without code changes.
  global_secondary_indexes = [
    {
      name            = "GSI1"
      hash_key        = "GSI1PK"
      range_key       = "GSI1SK"
      projection_type = "ALL"
    }
  ]

  tags = {
    Project = var.project
  }
}

# ============================================================
# DynamoDB — SeedMembersTable
#
# DNI roster used during the member onboarding flow.
# Identical to production; PITR disabled (data is re-seedable).
# ============================================================
module "seed_members_table" {
  source = "../../modules/dynamodb"

  table_name   = "SeedMembersTable"
  env          = var.env
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "DNI"
  enable_pitr  = false

  attributes = [
    { name = "DNI", type = "S" },
  ]

  global_secondary_indexes = []

  tags = {
    Project = var.project
  }
}

# ============================================================
# Cognito — User Pool, App Client, Domain, Groups
#
# Provides authentication and authorisation for the ActivaClub
# frontend and backend API in the development environment.
# ============================================================
module "cognito" {
  source = "../../modules/cognito"

  env     = var.env
  project = var.project

  tags = {
    Project = var.project
  }
}
