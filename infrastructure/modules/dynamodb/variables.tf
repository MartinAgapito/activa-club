variable "table_name" {
  description = "Base name for the DynamoDB table. The env suffix is appended by this module."
  type        = string
}

variable "billing_mode" {
  description = "DynamoDB billing mode. PAY_PER_REQUEST keeps dev cost at zero."
  type        = string
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.billing_mode)
    error_message = "billing_mode must be PAY_PER_REQUEST or PROVISIONED."
  }
}

variable "hash_key" {
  description = "Name of the partition key attribute."
  type        = string
}

variable "range_key" {
  description = "Name of the sort key attribute. Leave null for single-key tables."
  type        = string
  default     = null
}

variable "attributes" {
  description = <<-EOT
    List of attribute definitions required by the table key schema and GSIs.
    Only attributes referenced as keys need to be declared here.
    Example: [{ name = "pk", type = "S" }, { name = "sk", type = "S" }]
  EOT
  type = list(object({
    name = string
    type = string # S | N | B
  }))
}

variable "global_secondary_indexes" {
  description = <<-EOT
    List of Global Secondary Index definitions.
    Each entry maps to one GSI. projection_type must be ALL, KEYS_ONLY, or INCLUDE.
    Example:
      [{ name = "GSI_DNI", hash_key = "dni", projection_type = "KEYS_ONLY" }]
  EOT
  type = list(object({
    name            = string
    hash_key        = string
    projection_type = string # ALL | KEYS_ONLY | INCLUDE
  }))
  default = []
}

variable "tags" {
  description = "Map of AWS resource tags applied to the table."
  type        = map(string)
  default     = {}
}

variable "env" {
  description = "Deployment environment (dev | staging | prod). Appended to the table name."
  type        = string
}

variable "enable_pitr" {
  description = "Enable DynamoDB Point-in-Time Recovery. Set true for production."
  type        = bool
  default     = false
}
