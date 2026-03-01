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

variable "email_mfa_message" {
  description = "Email body template for the MFA OTP code sent by Cognito during login (AC-002). Must include the {####} placeholder which Cognito replaces with the 6-digit code."
  type        = string
  default     = "Tu código de verificación ActivaClub es: {####}. Válido por 3 minutos. No lo compartas con nadie."
}

variable "tags" {
  description = "Additional resource tags to merge with the module defaults. Applied to the User Pool."
  type        = map(string)
  default     = {}
}
