# ============================================================
# dev/bootstrap/outputs.tf
#
# Outputs from the DEV bootstrap run.
# Use these values to verify the backend config in dev/main.tf:
#   - state_bucket_name  → backend "s3" { bucket = ... }
#   - lock_table_name    → backend "s3" { dynamodb_table = ... }
# ============================================================

output "state_bucket_name" {
  description = "Name of the S3 bucket used for DEV Terraform remote state storage."
  value       = aws_s3_bucket.tf_state.bucket
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket used for DEV Terraform remote state storage."
  value       = aws_s3_bucket.tf_state.arn
}

output "lock_table_name" {
  description = "Name of the DynamoDB table used for DEV Terraform state locking."
  value       = aws_dynamodb_table.tf_lock.name
}

output "lock_table_arn" {
  description = "ARN of the DynamoDB table used for DEV Terraform state locking."
  value       = aws_dynamodb_table.tf_lock.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider in the DEV account."
  value       = aws_iam_openid_connect_provider.github_actions.arn
}

output "terraform_dev_role_arn" {
  description = "ARN of the Terraform DEV role assumed by GitHub Actions via OIDC."
  value       = aws_iam_role.terraform_dev.arn
}
