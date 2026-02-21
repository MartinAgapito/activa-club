terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ---------------------------------------------------------------------------
  # Remote backend — S3 state + DynamoDB lock.
  #
  # Before running `terraform init` here for the first time:
  #   1. Run the bootstrap module once:  cd infrastructure/bootstrap && terraform apply
  #   2. Replace <ACCOUNT_ID> below with your real AWS account ID, OR
  #      omit the bucket/dynamodb_table here and pass them at init time:
  #        terraform init \
  #          -backend-config="bucket=activa-club-tfstate-<ACCOUNT_ID>" \
  #          -backend-config="dynamodb_table=activa-club-tflock"
  # ---------------------------------------------------------------------------
  backend "s3" {
    bucket         = "activa-club-tfstate-<ACCOUNT_ID>" # replace <ACCOUNT_ID> or use -backend-config
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "activa-club-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project
      Env       = var.env
      ManagedBy = "terraform"
    }
  }
}

# ---------------------------------------------------------------------------
# Local values — shared tag map injected into every module call.
# ---------------------------------------------------------------------------
locals {
  common_tags = {
    Environment = var.env
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Module: SeedMembersTable
# ---------------------------------------------------------------------------
# Holds the authoritative member DNI list imported from the club's legacy
# roster. Used during registration to validate that a new sign-up belongs
# to a real, paid member (AC-001 DNI-match flow).
# Single-key table — no sort key, no GSIs.
module "seed_members_table" {
  source = "../../modules/dynamodb"

  table_name   = "SeedMembersTable"
  env          = var.env
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk" # pk = DNI string (e.g., "12345678")
  enable_pitr  = true # PITR enabled in production for data recovery.

  attributes = [
    { name = "pk", type = "S" },
  ]

  global_secondary_indexes = []

  tags = merge(local.common_tags, {
    Service = "members"
  })
}

# ---------------------------------------------------------------------------
# Module: MembersTable
# ---------------------------------------------------------------------------
# Main application table for registered members. Follows a single-table
# design: composite key pk (MEMBER#<uuid>) + sk (PROFILE).
# Three GSIs allow lookups by DNI, email, and Cognito sub without a scan.
module "members_table" {
  source = "../../modules/dynamodb"

  table_name   = "MembersTable"
  env          = var.env
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  enable_pitr  = true # PITR enabled in production for data recovery.

  # Only attributes used as table or GSI keys are declared here. All other
  # member attributes (name, phone, etc.) are schema-less DynamoDB items.
  attributes = [
    { name = "pk",              type = "S" },
    { name = "sk",              type = "S" },
    { name = "dni",             type = "S" },
    { name = "email",           type = "S" },
    { name = "cognito_user_id", type = "S" },
  ]

  global_secondary_indexes = [
    # Lookup member record by DNI during the AC-001 registration flow.
    {
      name            = "GSI_DNI"
      hash_key        = "dni"
      projection_type = "KEYS_ONLY"
    },
    # Lookup member record by email (e.g., forgot-password, admin search).
    {
      name            = "GSI_Email"
      hash_key        = "email"
      projection_type = "KEYS_ONLY"
    },
    # Reverse-lookup: given a Cognito sub, find the member record.
    {
      name            = "GSI_CognitoSub"
      hash_key        = "cognito_user_id"
      projection_type = "KEYS_ONLY"
    },
  ]

  tags = merge(local.common_tags, {
    Service = "members"
  })
}

# ---------------------------------------------------------------------------
# Module: Cognito User Pool
# ---------------------------------------------------------------------------
# Central identity provider for the ActivaClub SPA. Self-registration is
# disabled — only Admins/Managers can create user accounts, enforcing the
# AC-001 requirement that registration must be preceded by a DNI match.
module "cognito" {
  source = "../../modules/cognito"

  user_pool_name      = "activa-club-${var.env}"
  env                 = var.env
  deletion_protection = "ACTIVE" # Prevent accidental pool deletion in production.

  password_policy = {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
  }

  allow_self_registration  = false
  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  groups = [
    {
      name        = "Admin"
      description = "Full platform access — user management, reports, configuration."
      precedence  = 1
    },
    {
      name        = "Manager"
      description = "Promotions management and operational reports."
      precedence  = 2
    },
    {
      name        = "Member"
      description = "Standard member self-service access."
      precedence  = 3
    },
  ]

  tags = merge(local.common_tags, {
    Service = "auth"
  })
}
