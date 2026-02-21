# ============================================================
# modules/cognito/variables.tf
# ============================================================

variable "env" {
  description = "Deployment environment (e.g. 'production'). Appended to all resource names to support multiple environments in the same account."
  type        = string
}

variable "project" {
  description = "Project identifier used as a prefix in resource names. Defaults to 'activa-club'."
  type        = string
  default     = "activa-club"
}

variable "tags" {
  description = "Additional resource tags to merge with the module defaults. Applied to the User Pool."
  type        = map(string)
  default     = {}
}
