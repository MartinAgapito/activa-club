output "user_pool_id" {
  description = "ID of the Cognito User Pool. Referenced by API Gateway JWT authorizer."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "ARN of the Cognito User Pool."
  value       = aws_cognito_user_pool.this.arn
}

output "app_client_id" {
  description = "ID of the Cognito App Client. Used by the frontend SPA to initiate auth flows."
  value       = aws_cognito_user_pool_client.this.id
}

output "issuer_url" {
  description = <<-EOT
    JWT issuer URL for the API Gateway JWT authorizer.
    Format: https://cognito-idp.<region>.amazonaws.com/<user_pool_id>
  EOT
  value = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}
