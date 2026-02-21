variable "aws_region" {
  description = "AWS region where production resources are deployed."
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Deployment environment label. Appended to resource names."
  type        = string
  default     = "production"
}

variable "project" {
  description = "Project identifier used in tags and resource names."
  type        = string
  default     = "activa-club"
}
