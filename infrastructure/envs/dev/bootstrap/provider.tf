# ============================================================
# dev/bootstrap/provider.tf
#
# AWS provider configuration for the DEV bootstrap.
#
# The provider assumes a role in the DEV account so that no
# long-lived credentials are needed locally. The identity
# running this configuration (e.g. an SSO session or an IAM
# user in the PRD account) must have permission to call
# sts:AssumeRole on the target role.
# ============================================================

provider "aws" {
  region = var.aws_region

  # Assume a role in the DEV account.
  # The role must trust the identity running Terraform locally.
  assume_role {
    role_arn = "arn:aws:iam::${var.dev_account_id}:role/${var.dev_role_name}"
  }
}
