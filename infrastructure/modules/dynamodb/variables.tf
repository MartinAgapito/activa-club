# ============================================================
# modules/dynamodb/variables.tf
# ============================================================

variable "table_name" {
  description = "Logical name for the DynamoDB table. The environment suffix is appended automatically, e.g. 'MembersTable' becomes 'MembersTable-production'."
  type        = string
}

variable "env" {
  description = "Deployment environment (e.g. 'production'). Appended to the table name to allow multiple environments in the same account."
  type        = string
}

variable "billing_mode" {
  description = "DynamoDB billing mode. Use 'PAY_PER_REQUEST' for unpredictable workloads (free tier friendly). Use 'PROVISIONED' with read/write capacity units for predictable loads."
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "hash_key" {
  description = "Name of the partition key attribute. Must be included in var.attributes."
  type        = string
}

variable "range_key" {
  description = "Name of the sort key attribute. Leave empty string to create a hash-only table. Must be included in var.attributes when set."
  type        = string
  default     = ""
}

variable "attributes" {
  description = "List of attribute definitions. Only declare attributes that are used as key or index keys — DynamoDB is schemaless for other attributes."
  type = list(object({
    name = string
    type = string # "S" (String), "N" (Number), or "B" (Binary)
  }))
}

variable "global_secondary_indexes" {
  description = "List of Global Secondary Index configurations. Set to an empty list to create a table without GSIs."
  type = list(object({
    name               = string
    hash_key           = string
    range_key          = optional(string)
    projection_type    = string           # "ALL", "KEYS_ONLY", or "INCLUDE"
    non_key_attributes = optional(list(string)) # Required when projection_type = "INCLUDE"
  }))
  default = []
}

variable "enable_pitr" {
  description = "Enable Point-in-Time Recovery. Set to true for production tables to allow restore to any second in the last 35 days. Has no additional cost on PAY_PER_REQUEST tables."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional resource tags to merge with the module defaults."
  type        = map(string)
  default     = {}
}
