# ============================================================
# dev/bootstrap/variables.tf
#
# Input variables for the DEV bootstrap configuration.
# Pass required values on the command line or via a tfvars file:
#
#   cp terraform.tfvars.example terraform.tfvars
#   # Edit terraform.tfvars with real values
#   terraform apply
# ============================================================

variable "aws_region" {
  description = "AWS region where the backend resources are created. Must match the region used in dev/main.tf backend config."
  type        = string
  default     = "us-east-1"
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

variable "state_bucket_name" {
  description = "Name of the S3 bucket to create for DEV Terraform remote state. Must be globally unique. This value must match the bucket name in dev/main.tf backend config."
  type        = string
  default     = "ac-tfstate-dev"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table to create for DEV Terraform state locking. Must match the dynamodb_table value in dev/main.tf backend config."
  type        = string
  default     = "ac-tflock-dev"
}

variable "github_org" {
  description = "GitHub organisation or username. Used in the OIDC trust policy subject condition."
  type        = string
  default     = "MartinAgapito"
}

variable "github_repo" {
  description = "GitHub repository name (without org prefix)."
  type        = string
  default     = "activa-club"
}
