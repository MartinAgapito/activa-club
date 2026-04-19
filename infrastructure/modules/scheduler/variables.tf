# ============================================================
# modules/scheduler/variables.tf
# ============================================================

variable "schedule_name" {
  description = "Base name for the EventBridge Scheduler schedule and its IAM role. The environment suffix is appended automatically."
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge Scheduler expression. Examples: 'rate(1 hour)', 'cron(0 * * * ? *)'."
  type        = string
}

variable "target_lambda_arn" {
  description = "ARN of the Lambda function to invoke on each schedule trigger."
  type        = string
}

variable "target_lambda_name" {
  description = "Name (not ARN) of the target Lambda function. Used for the aws_lambda_permission resource."
  type        = string
}

variable "target_input" {
  description = "JSON string passed as the event payload to the Lambda on each invocation."
  type        = string
  default     = "{}"
}

variable "env" {
  description = "Deployment environment (e.g. 'dev'). Appended to resource names."
  type        = string
}

variable "tags" {
  description = "Additional resource tags merged with module defaults."
  type        = map(string)
  default     = {}
}
