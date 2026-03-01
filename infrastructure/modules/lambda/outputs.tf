# ============================================================
# modules/lambda/outputs.tf
# ============================================================

output "function_arn" {
  description = "ARN of the Lambda function."
  value       = aws_lambda_function.this.arn
}

output "function_name" {
  description = "Name of the Lambda function. Used when granting API Gateway invoke permissions."
  value       = aws_lambda_function.this.function_name
}

output "invoke_arn" {
  description = "ARN used as the integration URI in API Gateway (includes /invocations suffix)."
  value       = aws_lambda_function.this.invoke_arn
}

output "role_arn" {
  description = "ARN of the IAM execution role attached to the Lambda function."
  value       = aws_iam_role.this.arn
}
