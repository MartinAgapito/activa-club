# ============================================================
# bootstrap/outputs.tf
#
# Outputs from the bootstrap run.
# Use these values to configure secrets in GitHub Actions:
#   - AWS_ROLE_ARN        → cicd_role_arn
#   - TF_BACKEND_BUCKET   → state_bucket_name
#   - TF_BACKEND_DYNAMODB_TABLE → lock_table_name
# ============================================================

output "state_bucket_name" {
  description = "Name of the S3 bucket used for Terraform remote state storage."
  value       = aws_s3_bucket.tf_state.bucket
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket used for Terraform remote state storage."
  value       = aws_s3_bucket.tf_state.arn
}

output "lock_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking."
  value       = aws_dynamodb_table.tf_lock.name
}

output "cicd_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions via OIDC. Set this as the AWS_ROLE_ARN secret in the GitHub repository."
  value       = aws_iam_role.cicd.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider in the production account."
  value       = aws_iam_openid_connect_provider.github_actions.arn
}
