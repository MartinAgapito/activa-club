# ============================================================
# bootstrap/provider.tf
#
# AWS provider configuration for the production bootstrap.
# ============================================================

provider "aws" {
  region  = var.aws_region
  profile = "prd"
}
