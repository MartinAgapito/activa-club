variable "aws_region" {
  description = "AWS region where bootstrap resources are created."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project identifier used in resource names."
  type        = string
  default     = "activa-club"
}

variable "github_repo" {
  description = "GitHub repository in format ORG/REPO (e.g., my-org/activa-club). Used in OIDC trust policy."
  type        = string
}
