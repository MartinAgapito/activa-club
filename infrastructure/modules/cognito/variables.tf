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

variable "force_recreate_token" {
  description = "Bump this value (e.g. 'v1' → 'v2') to force Terraform to destroy and recreate the Cognito User Pool. Use when schema attributes are added and the existing pool cannot be updated in-place."
  type        = string
  default     = "v1"
}

variable "ses_from_email" {
  description = "Email address (verified in SES) used as the sender for Cognito emails (MFA OTP, account verification). Required when email_sending_account = DEVELOPER."
  type        = string
}

variable "ses_source_arn" {
  description = "ARN of the verified SES identity that Cognito uses to send emails. Format: arn:aws:ses:<region>:<account>:identity/<email>."
  type        = string
}

variable "custom_email_sender_lambda_arn" {
  description = "ARN of the CustomEmailSender Lambda function. When set, Cognito invokes this Lambda instead of sending emails directly."
  type        = string
  default     = ""
}

variable "custom_email_sender_kms_key_arn" {
  description = "ARN of the KMS key used by Cognito to encrypt the code before passing it to the CustomEmailSender Lambda."
  type        = string
  default     = ""
}
