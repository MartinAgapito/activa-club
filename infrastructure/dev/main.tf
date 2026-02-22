# ============================================================
# infrastructure/dev/main.tf
#
# DEV environment — wires together all infrastructure modules
# for ActivaClub in a separate AWS account.
#
# Remote state is stored in S3 (ac-tfstate-dev), which must be
# created manually or via a one-off bootstrap before the first
# terraform init in this folder.
#
# All module instances are tagged with env = "dev" so resources
# are identifiable and isolated from production.
#
# Authentication uses assume_role so local operators and CI/CD
# agents authenticate as themselves and then assume the dev role.
# ============================================================

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend — S3 bucket and DynamoDB lock table
  # must exist in the DEV account before running terraform init.
  # See README.md for one-time bootstrap instructions.
  backend "s3" {
    bucket         = "ac-tfstate-dev"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "ac-tflock-dev"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  # Assume the Terraform operator role in the DEV account.
  # The calling identity (local profile or CI/CD OIDC role) must
  # have sts:AssumeRole permission on this ARN.
  assume_role {
    role_arn     = "arn:aws:iam::${var.dev_account_id}:role/${var.dev_role_name}"
    session_name = "terraform-dev"
  }
}

# ============================================================
# DynamoDB — MembersTable
#
# Primary store for club members after they have been onboarded.
# Uses a composite key (PK + SK) to support multiple access
# patterns from a single table (single-table design).
#
# GSI1 enables queries by a secondary dimension without a
# full table scan.
#
# PITR is disabled in DEV to avoid unnecessary cost — data can
# be re-seeded from test fixtures at any time.
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

  # GSI1 allows queries keyed on GSI1PK / GSI1SK.
  # ALL projection mirrors production so query patterns are
  # fully testable in DEV without schema changes.
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
# Holds the test DNI roster used during the member onboarding
# flow. A Lambda checks this table to confirm that a registering
# user is a known member before creating their Cognito account.
#
# Simple hash-only key on DNI — no complex access patterns needed.
# PITR disabled — data can be re-seeded from test fixtures.
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
# frontend and backend API in the DEV environment.
# ============================================================
module "cognito" {
  source = "../../modules/cognito"

  env     = var.env
  project = var.project

  tags = {
    Project = var.project
  }
}
