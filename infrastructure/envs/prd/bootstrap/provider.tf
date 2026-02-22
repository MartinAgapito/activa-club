# ============================================================
# bootstrap/provider.tf
#
# AWS provider configuration for the production bootstrap.
# ============================================================

provider "aws" {
  region = var.aws_region

  assume_role {
    role_arn = "arn:aws:iam::${var.aws_account_id}:role/${var.aws_role_name}"
  }
}
