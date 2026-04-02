# ============================================================
# envs/prd/outputs.tf
#
# Exposes key resource identifiers from the prd environment.
# These values are used by:
#   - Lambda functions (via environment variables or SSM)
#   - The frontend build (injected as environment variables)
#   - Other Terraform configurations that reference this state
# ============================================================

# ---- DynamoDB -----------------------------------------------

output "members_table_name" {
  description = "Physical name of the MembersTable DynamoDB table."
  value       = module.members_table.table_name
}

output "members_table_arn" {
  description = "ARN of the MembersTable DynamoDB table. Use in Lambda IAM policies."
  value       = module.members_table.table_arn
}

output "seed_members_table_name" {
  description = "Physical name of the SeedMembersTable DynamoDB table."
  value       = module.seed_members_table.table_name
}

output "seed_members_table_arn" {
  description = "ARN of the SeedMembersTable DynamoDB table. Use in Lambda IAM policies."
  value       = module.seed_members_table.table_arn
}

# ---- Cognito ------------------------------------------------

output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool. Required by the frontend and backend Lambda functions."
  value       = module.cognito.user_pool_id
}

output "cognito_app_client_id" {
  description = "ID of the Cognito App Client. Passed to the frontend as a public configuration value (not a secret)."
  value       = module.cognito.app_client_id
}

output "cognito_issuer_url" {
  description = "OIDC issuer URL for the User Pool. Used to configure API Gateway JWT authorizers."
  value       = module.cognito.issuer_url
}

output "cognito_user_pool_domain" {
  description = "Cognito-hosted domain prefix. Full URL: https://<domain>.auth.us-east-1.amazoncognito.com"
  value       = module.cognito.user_pool_domain
}

# ---- Lambda -------------------------------------------------

output "members_lambda_function_name" {
  description = "Name of the activa-club-members Lambda function."
  value       = module.members_lambda.function_name
}

output "members_lambda_function_arn" {
  description = "ARN of the activa-club-members Lambda function."
  value       = module.members_lambda.function_arn
}

output "lambda_artifacts_bucket" {
  description = "S3 bucket where Lambda deployment packages are uploaded by CI/CD."
  value       = aws_s3_bucket.lambda_artifacts.bucket
}

# ---- API Gateway --------------------------------------------

output "api_endpoint" {
  description = "Base URL of the API Gateway. Append /v1/<resource> to call endpoints (e.g. POST <api_endpoint>/v1/auth/register)."
  value       = module.api_gateway.api_endpoint
}

output "api_id" {
  description = "ID of the API Gateway HTTP API. Used for Terraform cross-references."
  value       = module.api_gateway.api_id
}

# ---- Frontend (S3 + CloudFront) -----------------------------

output "frontend_bucket_name" {
  description = "S3 bucket where the React SPA assets are uploaded by CI/CD."
  value       = module.frontend.bucket_name
}

output "cloudfront_domain_name" {
  description = "CloudFront domain for the frontend SPA. Use as the app URL (https://<domain>)."
  value       = module.frontend.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID. Required by CI/CD for cache invalidation after each deploy."
  value       = module.frontend.cloudfront_distribution_id
}
