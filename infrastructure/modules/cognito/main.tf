# ============================================================
# modules/cognito/main.tf
#
# Cognito User Pool module for ActivaClub.
#
# Creates:
#   - User Pool with email-based sign-in and strong password policy
#   - App Client (no secret, SRP + password auth flows)
#   - Cognito-hosted domain for the OAuth2 / hosted UI endpoints
#   - Three groups: Admin, Manager, Member
#
# Design decisions:
#   - self-registration is disabled (allow_admin_create_user_only = true)
#     because membership requires a prior DNI validation step
#   - MFA is OFF by default (can be enabled per-user after onboarding)
#   - No client secret — the frontend is a SPA and cannot store secrets
# ============================================================

# ------------------------------------------------------------
# User Pool
# ------------------------------------------------------------
resource "aws_cognito_user_pool" "this" {
  name = "${var.project}-${var.env}"

  # Users sign in with their email address
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Disable self-registration — accounts are created by admins
  # after the DNI match flow completes
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  # Strong password policy
  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # MFA is off; individual users can enable TOTP later
  mfa_configuration = "OFF"

  # Account recovery via verified email only
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email verification message (uses Cognito default sender)
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  # Attribute schema — email is standard; no custom attributes needed yet
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 5
      max_length = 254
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project}-${var.env}"
    Environment = var.env
    ManagedBy   = "terraform"
  })
}

# ------------------------------------------------------------
# App Client — used by the ActivaClub frontend (SPA)
# No client secret — SPAs cannot store secrets securely
# ------------------------------------------------------------
resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.project}-app-client-${var.env}"
  user_pool_id = aws_cognito_user_pool.this.id

  # No secret — public client (SPA)
  generate_secret = false

  # Auth flows enabled:
  #   - USER_PASSWORD_AUTH : direct username/password sign-in
  #   - USER_SRP_AUTH      : Secure Remote Password (more secure)
  #   - REFRESH_TOKEN_AUTH : allow silent token refresh
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # Token validity
  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Hides whether a user exists during auth — prevents user enumeration
  prevent_user_existence_errors = "ENABLED"
}

# ------------------------------------------------------------
# Cognito-hosted domain
# Provides the /oauth2/token, /login, /logout endpoints.
# Domain name must be globally unique across all AWS accounts.
# ------------------------------------------------------------
resource "aws_cognito_user_pool_domain" "this" {
  domain       = "${var.project}-${var.env}"
  user_pool_id = aws_cognito_user_pool.this.id
}

# ------------------------------------------------------------
# User Groups
# Precedence determines which group's permissions apply when
# a user belongs to multiple groups (lower = higher priority).
# ------------------------------------------------------------

# Administrators — full club management access
resource "aws_cognito_user_group" "admin" {
  name         = "Admin"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Club administrators with full management access"
  precedence   = 1
}

# Managers — day-to-day operations, cannot manage other admins
resource "aws_cognito_user_group" "manager" {
  name         = "Manager"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Club managers responsible for day-to-day operations"
  precedence   = 2
}

# Members — regular club members, read-only on most resources
resource "aws_cognito_user_group" "member" {
  name         = "Member"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Regular club members"
  precedence   = 3
}
