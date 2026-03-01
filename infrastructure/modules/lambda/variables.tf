# ============================================================
# modules/lambda/variables.tf
# ============================================================

variable "function_name" {
  description = "Name of the Lambda function. Must be unique within the AWS account."
  type        = string
}

variable "handler" {
  description = "Entry-point handler path inside the deployment package (e.g. 'dist/main.handler')."
  type        = string
  default     = "dist/main.handler"
}

variable "runtime" {
  description = "Lambda runtime identifier."
  type        = string
  default     = "nodejs20.x"
}

variable "s3_bucket" {
  description = "Name of the S3 bucket that holds the Lambda deployment package."
  type        = string
}

variable "s3_key" {
  description = "S3 object key for the Lambda ZIP package (e.g. 'members/members.zip')."
  type        = string
}

variable "memory_size" {
  description = "Amount of memory (MB) allocated to the Lambda function."
  type        = number
  default     = 256
}

variable "timeout" {
  description = "Maximum execution time in seconds before the function is terminated."
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Key-value pairs injected as environment variables into the Lambda runtime."
  type        = map(string)
  default     = {}
}

# ---- DynamoDB ------------------------------------------------

variable "dynamodb_table_arns" {
  description = "ARNs of DynamoDB tables this Lambda needs read/write access to. Index ARNs (arn/index/*) are automatically included."
  type        = list(string)
  default     = []
}

# ---- Cognito -------------------------------------------------

variable "cognito_user_pool_arns" {
  description = "ARNs of Cognito User Pools this Lambda needs to call admin APIs on."
  type        = list(string)
  default     = []
}

variable "cognito_actions" {
  description = "List of cognito-idp IAM actions to grant. Only effective when cognito_user_pool_arns is non-empty."
  type        = list(string)
  default     = []
}

# ---- SNS -----------------------------------------------------

variable "sns_topic_arns" {
  description = "ARNs of SNS topics this Lambda is allowed to publish to."
  type        = list(string)
  default     = []
}

# ---- SSM -----------------------------------------------------

variable "ssm_parameter_paths" {
  description = "SSM Parameter Store paths this Lambda is allowed to read. Include the leading slash (e.g. '/activa-club/dev/stripe-secret')."
  type        = list(string)
  default     = []
}

# ---- Misc ----------------------------------------------------

variable "env" {
  description = "Deployment environment (e.g. 'dev'). Used in resource names and tags."
  type        = string
}

variable "tags" {
  description = "Additional resource tags merged with module defaults."
  type        = map(string)
  default     = {}
}
