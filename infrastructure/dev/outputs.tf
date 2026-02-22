# ============================================================
# infrastructure/dev/outputs.tf
#
# Exposes key resource identifiers from the DEV environment.
# These values are used by:
#   - Lambda functions (via environment variables or SSM)
#   - The frontend build (injected as environment variables)
#   - Other Terraform configurations that reference this state
# ============================================================

# ---- DynamoDB -----------------------------------------------

output "members_table_name" {
  description = "Physical name of the MembersTable DynamoDB table in DEV."
  value       = module.members_table.table_name
}

output "members_table_arn" {
  description = "ARN of the MembersTable DynamoDB table in DEV. Use in Lambda IAM policies."
  value       = module.members_table.table_arn
}

output "seed_members_table_name" {
  description = "Physical name of the SeedMembersTable DynamoDB table in DEV."
  value       = module.seed_members_table.table_name
}

output "seed_members_table_arn" {
  description = "ARN of the SeedMembersTable DynamoDB table in DEV. Use in Lambda IAM policies."
  value       = module.seed_members_table.table_arn
}

# ---- Cognito ------------------------------------------------

output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool in DEV. Required by the frontend and backend Lambda functions."
  value       = module.cognito.user_pool_id
}

output "cognito_app_client_id" {
  description = "ID of the Cognito App Client in DEV. Passed to the frontend as a public configuration value (not a secret)."
  value       = module.cognito.app_client_id
}

output "cognito_issuer_url" {
  description = "OIDC issuer URL for the DEV User Pool. Used to configure API Gateway JWT authorizers."
  value       = module.cognito.issuer_url
}

output "cognito_user_pool_domain" {
  description = "Cognito-hosted domain prefix for DEV. Full URL: https://<domain>.auth.us-east-1.amazoncognito.com"
  value       = module.cognito.user_pool_domain
}
