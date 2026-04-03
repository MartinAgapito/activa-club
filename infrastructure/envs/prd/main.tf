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
      # >= 5.60 required for aws_cognito_user_pool email_mfa_configuration block
      source  = "hashicorp/aws"
      version = "~> 5.60"
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
# GSI_DNI, GSI_Email, GSI_CognitoSub enable uniqueness checks
# and lookups without full table scans.
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
    { name = "cognito_user_id", type = "S" },
  ]

  # GSI_DNI       — duplicate-DNI check and lookup by DNI.
  # GSI_Email     — duplicate-email check and lookup by email.
  # GSI_CognitoSub — lookup member profile by Cognito sub from JWT claims (AC-002+).
  # All use KEYS_ONLY — full item is fetched via GetItem after the index query.
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
    {
      name            = "GSI_CognitoSub"
      hash_key        = "cognito_user_id"
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

  # OTP email template for login MFA (AC-002).
  # For production, configure SES out of sandbox to avoid send limits.
  email_mfa_message = "Tu código de verificación ActivaClub es: {####}. Válido por 3 minutos."

  tags = {
    Project = var.project
  }
}

# ============================================================
# S3 — Lambda Artifacts Bucket
#
# Holds the ZIP packages uploaded by the CI/CD pipeline.
# One bucket per environment; versioning enabled so each deploy
# can be rolled back by updating the Lambda's s3_key.
# ============================================================
resource "aws_s3_bucket" "lambda_artifacts" {
  bucket = "${var.project}-lambda-artifacts-${var.env}"

  tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "lambda_artifacts" {
  bucket = aws_s3_bucket.lambda_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Block all public access — only the Lambda execution role and CI/CD can read
resource "aws_s3_bucket_public_access_block" "lambda_artifacts" {
  bucket                  = aws_s3_bucket.lambda_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ============================================================
# Lambda — activa-club-members
#
# Handles: registration, email verification, resend code (AC-001)
#          login, OTP verification (AC-002)
#
# IAM grants:
#   DynamoDB  — MembersTable + SeedMembersTable (read/write/index)
#   Cognito   — SignUp/ConfirmSignUp use App Client (no IAM needed);
#               AdminGetUser, AdminAddUserToGroup, AdminDeleteUser,
#               AdminInitiateAuth, AdminRespondToAuthChallenge (IAM)
# ============================================================
module "members_lambda" {
  source = "../../modules/lambda"

  function_name = "${var.project}-members-${var.env}"
  handler       = "dist/src/lambda.handler"
  runtime       = "nodejs20.x"
  memory_size   = 256
  timeout       = 30
  env           = var.env

  s3_bucket = aws_s3_bucket.lambda_artifacts.bucket
  s3_key    = "members/members.zip"

  environment_variables = {
    ENV                     = var.env
    DYNAMODB_REGION         = var.aws_region
    MEMBERS_TABLE_NAME      = module.members_table.table_name
    SEED_MEMBERS_TABLE_NAME = module.seed_members_table.table_name
    COGNITO_USER_POOL_ID    = module.cognito.user_pool_id
    COGNITO_CLIENT_ID       = module.cognito.app_client_id
    NO_COLOR                = "1"
  }

  dynamodb_table_arns = [
    module.members_table.table_arn,
    module.seed_members_table.table_arn,
  ]

  cognito_user_pool_arns = [module.cognito.user_pool_arn]

  # AdminGetUser + AdminAddUserToGroup + AdminDeleteUser (AC-001 post-confirmation)
  # AdminInitiateAuth + AdminRespondToAuthChallenge (AC-002 login)
  # SignUp / ConfirmSignUp / ResendConfirmationCode use App Client — no IAM needed
  cognito_actions = [
    "cognito-idp:AdminGetUser",
    "cognito-idp:AdminAddUserToGroup",
    "cognito-idp:AdminDeleteUser",
    "cognito-idp:AdminInitiateAuth",
    "cognito-idp:AdminRespondToAuthChallenge",
  ]

  tags = {
    Project = var.project
  }
}

# ============================================================
# API Gateway — ActivaClub HTTP API
#
# Public routes (auth_required = false):
#   POST /v1/auth/register      — Step 1: DNI validation + SignUp
#   POST /v1/auth/verify-email  — Step 2: OTP → account activated
#   POST /v1/auth/resend-code   — Resend email OTP
#   POST /v1/auth/login         — Login Step 1: credentials → MFA challenge
#   POST /v1/auth/verify-otp    — Login Step 2: OTP → tokens
#
# Protected routes will be added per future story (AC-003+).
# ============================================================
module "api_gateway" {
  source = "../../modules/api-gateway"

  api_name = "${var.project}-api-${var.env}"
  env      = var.env

  cognito_issuer_url = module.cognito.issuer_url
  cognito_audience   = [module.cognito.app_client_id]

  cors_origins = [
    "http://localhost:5173", # Vite dev server (keep for staging/testing)
    "http://localhost:3000", # Alternative local port
    "https://${module.frontend.cloudfront_domain_name}",
  ]

  routes = [
    # ── AC-001: Registration ──────────────────────────────────────
    {
      method               = "POST"
      path                 = "/v1/auth/register"
      lambda_invoke_arn    = module.members_lambda.invoke_arn
      lambda_function_name = "${var.project}-members-${var.env}"
      auth_required        = false
    },
    {
      method               = "POST"
      path                 = "/v1/auth/verify-email"
      lambda_invoke_arn    = module.members_lambda.invoke_arn
      lambda_function_name = "${var.project}-members-${var.env}"
      auth_required        = false
    },
    {
      method               = "POST"
      path                 = "/v1/auth/resend-code"
      lambda_invoke_arn    = module.members_lambda.invoke_arn
      lambda_function_name = "${var.project}-members-${var.env}"
      auth_required        = false
    },
    # ── AC-002: Login ─────────────────────────────────────────────
    {
      method               = "POST"
      path                 = "/v1/auth/login"
      lambda_invoke_arn    = module.members_lambda.invoke_arn
      lambda_function_name = "${var.project}-members-${var.env}"
      auth_required        = false
    },
    {
      method               = "POST"
      path                 = "/v1/auth/verify-otp"
      lambda_invoke_arn    = module.members_lambda.invoke_arn
      lambda_function_name = "${var.project}-members-${var.env}"
      auth_required        = false
    },
  ]

  tags = {
    Project = var.project
  }
}

# ============================================================
# Frontend — S3 + CloudFront
#
# Hosts the built React SPA. CloudFront serves assets globally
# and rewrites 403/404 to /index.html for React Router support.
# The CI/CD pipeline uploads dist/ here after each frontend build.
# ============================================================
module "frontend" {
  source = "../../modules/s3-cloudfront"

  bucket_name = "${var.project}-frontend-${var.env}"
  environment = var.env

  tags = {
    Project = var.project
  }
}
