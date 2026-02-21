# ============================================================
# envs/production/variables.tf
# ============================================================

variable "aws_region" {
  description = "AWS region where all resources are deployed. Changing this requires updating the backend config and provider in main.tf as well."
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Deployment environment name. Used as a suffix on all resource names. Must match the S3 backend key prefix."
  type        = string
  default     = "production"
}

variable "project" {
  description = "Project name used as a tag and passed to modules as a naming prefix."
  type        = string
  default     = "activa-club"
}
