# ============================================================
# bootstrap/variables.tf
#
# Input variables for the bootstrap configuration.
# Pass these on the command line when running:
#   terraform apply -var="github_org=MartinAgapito" \
#                   -var="github_repo=activa-club"
# ============================================================

variable "aws_account_id" {
  description = "AWS account ID. Used to construct resource ARNs and bucket names."
  type        = string
  default     = "583075178346"
}

variable "aws_role_name" {
  description = "Name of the IAM role in the PRD account that Terraform will assume. The role must trust the identity running Terraform locally."
  type        = string
  default     = "activa-club-terraform-role"
}

variable "aws_profile" {
  description = "AWS CLI profile to use for bootstrap operations. Must have permissions to create S3, DynamoDB, IAM, and OIDC resources."
  type        = string
  default     = "activaclub-prd"
}

variable "aws_region" {
  description = "AWS region where bootstrap resources are created."
  type        = string
  default     = "us-east-1"
}

variable "github_org" {
  description = "GitHub organisation or username that owns the repository. Used in the OIDC trust policy subject condition."
  type        = string
  default     = "MartinAgapito"
}

variable "github_repo" {
  description = "GitHub repository name (without the org prefix). Combined with github_org to form the OIDC sub claim."
  type        = string
  default     = "activa-club"
}

variable "env" {
  description = "Deployment environment label. Used for tagging bootstrap resources."
  type        = string
  default     = "prd"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform remote state. Must match the bucket name in the prd workflow backend config."
  type        = string
  default     = "activa-club-tfstate-prd-583075178346"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking. Must match the dynamodb_table value in the prd workflow backend config."
  type        = string
  default     = "activa-club-tflock-prd"
}
