# ============================================================
# modules/api-gateway/outputs.tf
# ============================================================

output "api_id" {
  description = "ID of the API Gateway HTTP API."
  value       = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "Base URL of the API Gateway stage (e.g. 'https://abc123.execute-api.us-east-1.amazonaws.com'). Append /v1/<resource> to call specific endpoints."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "execution_arn" {
  description = "Execution ARN of the API Gateway. Used to scope Lambda invoke permissions."
  value       = aws_apigatewayv2_api.this.execution_arn
}
