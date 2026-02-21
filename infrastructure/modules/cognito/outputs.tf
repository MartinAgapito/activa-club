# ============================================================
# modules/cognito/outputs.tf
# ============================================================

output "user_pool_id" {
  description = "The ID of the Cognito User Pool. Used by Lambda functions and the frontend to interact with Cognito."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "The ARN of the Cognito User Pool. Use this in IAM policies to grant Lambda functions Cognito permissions."
  value       = aws_cognito_user_pool.this.arn
}

output "app_client_id" {
  description = "The ID of the Cognito App Client. Passed to the frontend as a public configuration value."
  value       = aws_cognito_user_pool_client.this.id
}

output "user_pool_domain" {
  description = "The Cognito-hosted domain prefix (without the full URL). Full URL is: https://<domain>.auth.us-east-1.amazoncognito.com"
  value       = aws_cognito_user_pool_domain.this.domain
}

output "issuer_url" {
  description = "The OIDC issuer URL for the User Pool. Used to configure API Gateway JWT authorizers and other OIDC-aware services."
  value       = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.this.id}"
}
