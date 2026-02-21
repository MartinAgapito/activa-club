output "table_name" {
  description = "The full name of the DynamoDB table (includes env suffix)."
  value       = aws_dynamodb_table.this.name
}

output "table_arn" {
  description = "ARN of the DynamoDB table. Used in IAM policy statements for Lambda roles."
  value       = aws_dynamodb_table.this.arn
}
