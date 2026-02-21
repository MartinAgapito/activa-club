# ============================================================
# modules/dynamodb/outputs.tf
# ============================================================

output "table_name" {
  description = "The full physical name of the DynamoDB table (includes the environment suffix)."
  value       = aws_dynamodb_table.this.name
}

output "table_arn" {
  description = "The ARN of the DynamoDB table. Use this in IAM policies to grant Lambda functions access to this specific table."
  value       = aws_dynamodb_table.this.arn
}
