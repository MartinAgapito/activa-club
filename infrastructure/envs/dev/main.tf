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

data "aws_caller_identity" "current" {}

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
# SES — Email identity for Cognito sender
#
# Cognito Email MFA requires EmailSendingAccount = DEVELOPER (SES).
# Terraform creates the identity and sends a verification email to
# this address. The link must be clicked before Cognito can send OTPs.
# ============================================================
resource "aws_ses_email_identity" "cognito_sender" {
  email = "developer.maas@gmail.com"
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

  # OTP email template for login MFA (AC-002).
  email_mfa_message = "Tu código de verificación ActivaClub es: {####}. Válido por 3 minutos."

  # SES sender — required for Email MFA (COGNITO_DEFAULT not supported).
  ses_from_email = aws_ses_email_identity.cognito_sender.email
  ses_source_arn = aws_ses_email_identity.cognito_sender.arn

  # Bump to force destroy + recreate of the User Pool (e.g. when schema changes).
  # v1 → v2: recreate to include custom:dni attribute in the pool schema.
  # v2 → v3: recreate any pool created before custom:dni schema was applied.
  # v3 → v4: recreate to add SES email_configuration for Email MFA support.
  # v4 → v5: recreate so Cognito registers kms:CreateGrant on the custom KMS key
  #           (key policy lacked CreateGrant when lambda_config was first applied,
  #           causing Cognito to fall back to its internal key — fixes InvalidCiphertextException).
  force_recreate_token = "v5"

  # CustomEmailSender trigger (AC-003).
  # Cognito encrypts the OTP code with this KMS key and passes it to the Lambda.
  custom_email_sender_lambda_arn  = aws_lambda_function.email_sender.arn
  custom_email_sender_kms_key_arn = aws_kms_key.cognito_email.arn

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
  # AdminUserGlobalSignOut (AC-008 logout)
  # SignUp / ConfirmSignUp / ResendConfirmationCode use App Client — no IAM needed
  cognito_actions = [
    "cognito-idp:AdminGetUser",
    "cognito-idp:AdminAddUserToGroup",
    "cognito-idp:AdminDeleteUser",
    "cognito-idp:AdminInitiateAuth",
    "cognito-idp:AdminRespondToAuthChallenge",
    "cognito-idp:AdminUserGlobalSignOut",
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
# Protected routes (auth_required = true):
#   POST /v1/auth/logout        — AC-008: revoke all Cognito sessions
# ============================================================
module "api_gateway" {
  source = "../../modules/api-gateway"

  api_name = "${var.project}-api-${var.env}"
  env      = var.env

  cognito_issuer_url = module.cognito.issuer_url
  cognito_audience   = [module.cognito.app_client_id]

  cors_origins = [
    "http://localhost:5173", # Vite dev server
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
    # ── AC-008: Logout ────────────────────────────────────────────
    {
      method               = "POST"
      path                 = "/v1/auth/logout"
      lambda_invoke_arn    = module.members_lambda.invoke_arn
      lambda_function_name = "${var.project}-members-${var.env}"
      auth_required        = true
    },
  ]

  tags = {
    Project = var.project
  }
}

# ============================================================
# KMS — Cognito CustomEmailSender encryption key
#
# Cognito encrypts the confirmation code with this key before
# invoking the CustomEmailSender Lambda. The Lambda needs
# kms:Decrypt to read it.
# ============================================================
resource "aws_kms_key" "cognito_email" {
  description             = "${var.project}-cognito-email-${var.env}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  # Cognito needs kms:CreateGrant + kms:DescribeKey to use this key for
  # encrypting the CustomEmailSender code. Without CreateGrant, Cognito
  # falls back to its own internal key and our Lambda can't decrypt.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCognitoToUseKey"
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Action = [
          "kms:CreateGrant",
          "kms:DescribeKey",
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "cognito_email" {
  name          = "alias/${var.project}-cognito-email-${var.env}"
  target_key_id = aws_kms_key.cognito_email.key_id
}

# ============================================================
# IAM — Email Sender Lambda execution role
# ============================================================
resource "aws_iam_role" "email_sender_lambda" {
  name = "${var.project}-email-sender-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "email_sender_basic" {
  role       = aws_iam_role.email_sender_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "email_sender_kms_ses" {
  name = "${var.project}-email-sender-kms-ses-${var.env}"
  role = aws_iam_role.email_sender_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowKMSDecrypt"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = aws_kms_key.cognito_email.arn
      },
      {
        Sid      = "AllowSESSend"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      }
    ]
  })
}

# ============================================================
# Lambda — activa-club-email-sender
#
# Invoked by Cognito as CustomEmailSender trigger.
# Decrypts the code via KMS and sends HTML emails via SES.
# Uses the same S3 artifact as the members Lambda.
# ============================================================
resource "aws_lambda_function" "email_sender" {
  function_name = "${var.project}-email-sender-${var.env}"
  role          = aws_iam_role.email_sender_lambda.arn
  handler       = "dist/src/email-sender.handler"
  runtime       = "nodejs20.x"
  memory_size   = 256
  timeout       = 30

  s3_bucket = aws_s3_bucket.lambda_artifacts.bucket
  s3_key    = "members/members.zip"

  environment {
    variables = {
      AWS_REGION_NAME = var.aws_region
      KMS_KEY_ARN     = aws_kms_key.cognito_email.arn
      SES_FROM_EMAIL  = aws_ses_email_identity.cognito_sender.email
      FRONTEND_URL    = "https://${module.frontend.cloudfront_domain_name}"
      NO_COLOR        = "1"
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

# Allow Cognito to invoke the email sender Lambda
resource "aws_lambda_permission" "cognito_email_sender" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_sender.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = module.cognito.user_pool_arn
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
