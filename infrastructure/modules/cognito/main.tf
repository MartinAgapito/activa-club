terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------
# Current region is exposed as an output (issuer_url) so it must be resolved
# at the module level rather than relying on the caller's provider config.
data "aws_region" "current" {}

# ---------------------------------------------------------------------------
# Cognito User Pool
# ---------------------------------------------------------------------------
resource "aws_cognito_user_pool" "this" {
  name = var.user_pool_name

  # Users identify themselves with their email address.
  username_attributes      = var.username_attributes
  auto_verified_attributes = var.auto_verified_attributes

  # Controlled by the caller: use "INACTIVE" for dev/staging, "ACTIVE" for production.
  deletion_protection = var.deletion_protection

  # Self-registration is disabled: members are created by Admins/Managers.
  admin_create_user_config {
    allow_admin_create_user_only = !var.allow_self_registration
  }

  password_policy {
    minimum_length    = var.password_policy.minimum_length
    require_uppercase = var.password_policy.require_uppercase
    require_lowercase = var.password_policy.require_lowercase
    require_numbers   = var.password_policy.require_numbers
    require_symbols   = var.password_policy.require_symbols
  }

  # Account recovery — email only (no SMS to avoid SNS charges in dev).
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Emit Cognito events to CloudWatch Logs (no extra cost).
  user_pool_add_ons {
    advanced_security_mode = "OFF" # Advanced Security is a paid feature.
  }

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

  tags = var.tags
}

# ---------------------------------------------------------------------------
# App Client
# ---------------------------------------------------------------------------
# No client secret: the frontend SPA uses PKCE + USER_PASSWORD_AUTH.
# ALLOW_REFRESH_TOKEN_AUTH is always included so token refresh works.
resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.user_pool_name}-client"
  user_pool_id = aws_cognito_user_pool.this.id

  # No client secret — required for public clients (SPA, mobile).
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",   # Standard email+password sign-in.
    "ALLOW_REFRESH_TOKEN_AUTH",   # Mandatory for token refresh.
    "ALLOW_USER_SRP_AUTH",        # SRP-based auth (recommended for mobile).
  ]

  # Token validity — kept short in dev for faster iteration.
  access_token_validity  = 1   # hours
  id_token_validity      = 1   # hours
  refresh_token_validity = 30  # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent user existence errors from leaking in sign-in responses.
  prevent_user_existence_errors = "ENABLED"
}

# ---------------------------------------------------------------------------
# User Groups
# ---------------------------------------------------------------------------
# for_each over the groups list keyed by group name for stable addressing.
resource "aws_cognito_user_group" "this" {
  for_each = { for g in var.groups : g.name => g }

  user_pool_id = aws_cognito_user_pool.this.id
  name         = each.value.name
  description  = each.value.description
  precedence   = each.value.precedence
}
