output "seed_members_table_arn" {
  description = "ARN of SeedMembersTable. Grant this to the registration Lambda IAM role."
  value       = module.seed_members_table.table_arn
}

output "seed_members_table_name" {
  description = "Full name of SeedMembersTable (includes env suffix)."
  value       = module.seed_members_table.table_name
}

output "members_table_arn" {
  description = "ARN of MembersTable. Grant this to all member-service Lambdas."
  value       = module.members_table.table_arn
}

output "members_table_name" {
  description = "Full name of MembersTable (includes env suffix)."
  value       = module.members_table.table_name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID. Set as COGNITO_USER_POOL_ID in Lambda SSM parameters."
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN. Used in IAM policies for admin Lambda operations."
  value       = module.cognito.user_pool_arn
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID. Set as COGNITO_CLIENT_ID in the frontend build."
  value       = module.cognito.app_client_id
}

output "cognito_issuer_url" {
  description = "JWT issuer URL passed to the API Gateway JWT authorizer configuration."
  value       = module.cognito.issuer_url
}
