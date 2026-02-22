# ============================================================
# dev/variables.tf
# ============================================================

variable "aws_region" {
  description = "AWS region where all resources are deployed. Must match the region of the DEV backend bucket."
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Deployment environment name. Used as a suffix on all resource names."
  type        = string
  default     = "dev"
}

variable "project" {
  description = "Project name used as a tag and passed to modules as a naming prefix."
  type        = string
  default     = "activa-club"
}

variable "dev_account_id" {
  description = "AWS account ID of the DEV account. Used to construct the assume_role ARN. Must be supplied via terraform.tfvars or TF_VAR_dev_account_id — no default to avoid accidental misconfiguration."
  type        = string
  # No default — must be supplied explicitly.
}

variable "dev_role_name" {
  description = "Name of the IAM role in the DEV account that Terraform will assume. The role must trust the identity running Terraform locally."
  type        = string
  default     = "activa-club-terraform-dev-role"
}
