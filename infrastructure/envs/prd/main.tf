# ============================================================
# envs/prd/main.tf
#
# Production environment — wires together all infrastructure
# modules for ActivaClub.
#
# Remote state is stored in S3 (created by the bootstrap).
# All module instances are tagged with the environment so
# resources are identifiable in the AWS console.
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
# PITR is enabled for production so we can recover from
# accidental data deletion.
# ============================================================
module "members_table" {
  source = "../../modules/dynamodb"

  table_name   = "MembersTable"
  env          = var.env
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"
  enable_pitr  = true

  # Declare every attribute used as a key or index key
  attributes = [
    { name = "PK", type = "S" },
    { name = "SK", type = "S" },
    { name = "dni", type = "S" },
    { name = "email", type = "S" },
  ]

  # GSI_DNI: uniqueness check and lookup by DNI.
  # GSI_Email: uniqueness check and lookup by email.
  # Both use KEYS_ONLY projection — the handler fetches the full item via GetItem.
  global_secondary_indexes = [
    {
      name            = "GSI_DNI"
      hash_key        = "dni"
      range_key       = null
      projection_type = "KEYS_ONLY"
    },
    {
      name            = "GSI_Email"
      hash_key        = "email"
      range_key       = null
      projection_type = "KEYS_ONLY"
    },
  ]

  tags = {
    Project = var.project
  }
}

# ============================================================
# DynamoDB — SeedMembersTable
#
# Holds the legacy DNI roster used during the member onboarding
# flow. A Lambda checks this table to confirm that a registering
# user is a known member before creating their Cognito account.
#
# Simple hash-only key on DNI — no complex access patterns needed.
# PITR disabled because this data can be re-seeded from the source.
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
# frontend and backend API.
# ============================================================
module "cognito" {
  source = "../../modules/cognito"

  env     = var.env
  project = var.project

  tags = {
    Project = var.project
  }
}
