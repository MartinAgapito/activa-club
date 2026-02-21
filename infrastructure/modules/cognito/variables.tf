variable "user_pool_name" {
  description = "Name of the Cognito User Pool (e.g., activa-club-dev)."
  type        = string
}

variable "env" {
  description = "Deployment environment (dev | staging | prod). Used for resource tagging and naming."
  type        = string
}

variable "password_policy" {
  description = "Password policy applied to all users in the pool."
  type = object({
    minimum_length    = number
    require_uppercase = bool
    require_lowercase = bool
    require_numbers   = bool
    require_symbols   = bool
  })
  default = {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
  }
}

variable "allow_self_registration" {
  description = <<-EOT
    Whether end-users can sign themselves up. Set to false for club environments
    where accounts are provisioned by an Admin.
  EOT
  type    = bool
  default = false
}

variable "auto_verified_attributes" {
  description = "Attributes that Cognito verifies automatically (email and/or phone_number)."
  type        = list(string)
  default     = ["email"]
}

variable "username_attributes" {
  description = "Which attributes users can use as their username (email and/or phone_number)."
  type        = list(string)
  default     = ["email"]
}

variable "groups" {
  description = <<-EOT
    List of Cognito User Pool groups to create.
    Lower precedence number = higher privilege.
    Example:
      [
        { name = "Admin",   description = "Full platform access",          precedence = 1 },
        { name = "Manager", description = "Promotions management",         precedence = 2 },
        { name = "Member",  description = "Standard member self-service",  precedence = 3 }
      ]
  EOT
  type = list(object({
    name        = string
    description = string
    precedence  = number
  }))
  default = []
}

variable "deletion_protection" {
  description = "Cognito User Pool deletion protection. Use ACTIVE for production."
  type        = string
  default     = "INACTIVE"

  validation {
    condition     = contains(["ACTIVE", "INACTIVE"], var.deletion_protection)
    error_message = "deletion_protection must be ACTIVE or INACTIVE."
  }
}

variable "tags" {
  description = "Map of AWS resource tags."
  type        = map(string)
  default     = {}
}
