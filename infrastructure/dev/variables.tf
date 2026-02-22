# ============================================================
# infrastructure/dev/variables.tf
# ============================================================

variable "aws_region" {
  description = "AWS region where all DEV resources are deployed. Must match the backend config region."
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Deployment environment name. Used as a suffix on all resource names. Must match the S3 backend key prefix."
  type        = string
  default     = "dev"
}

variable "project" {
  description = "Project name used as a tag and passed to modules as a naming prefix."
  type        = string
  default     = "activa-club"
}

variable "dev_account_id" {
  description = "AWS account ID of the DEV account. Used to construct the assume_role ARN and resource ARNs. Supply via terraform.tfvars or TF_VAR_dev_account_id."
  type        = string
  # No default — must be supplied explicitly to avoid accidentally
  # targeting the wrong account.
}

variable "dev_role_name" {
  description = "Name of the IAM role to assume in the DEV account. The calling identity must have sts:AssumeRole permission on this role."
  type        = string
  default     = "activa-club-terraform-dev-role"
}
