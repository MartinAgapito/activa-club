output "tf_state_bucket_name" {
  description = "Name of the S3 bucket storing Terraform remote state. Use this as the bucket value in each environment's backend config."
  value       = aws_s3_bucket.tf_state.bucket
}

output "tf_lock_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking."
  value       = aws_dynamodb_table.tf_lock.name
}

output "cicd_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions via OIDC. Store this as the AWS_ROLE_ARN secret in GitHub repository settings."
  value       = aws_iam_role.cicd.arn
}
