# ============================================================
# modules/api-gateway/variables.tf
# ============================================================

variable "api_name" {
  description = "Name of the API Gateway HTTP API."
  type        = string
}

variable "cognito_issuer_url" {
  description = "OIDC issuer URL of the Cognito User Pool used by the JWT authorizer (e.g. 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXX')."
  type        = string
}

variable "cognito_audience" {
  description = "List of Cognito App Client IDs accepted by the JWT authorizer."
  type        = list(string)
}

variable "routes" {
  description = <<-EOT
    List of route definitions. Each route maps an HTTP method + path to a Lambda function.

    Fields:
      method               - HTTP method in uppercase (e.g. "POST", "GET").
      path                 - Resource path starting with /v1/ (e.g. "/v1/auth/register").
      lambda_invoke_arn    - The Lambda invoke ARN used as the integration URI (aws_lambda_function.invoke_arn).
      lambda_function_name - The Lambda function name used to grant invoke permissions.
      auth_required        - true → JWT authorizer; false → public route (no auth).
  EOT
  type = list(object({
    method               = string
    path                 = string
    lambda_invoke_arn    = string
    lambda_function_name = string
    auth_required        = bool
  }))
}

variable "cors_origins" {
  description = "Allowed CORS origins for the API. Include the CloudFront domain and localhost for dev."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "stage_name" {
  description = "API Gateway stage name. Use '$default' for HTTP APIs to avoid a path prefix."
  type        = string
  default     = "$default"
}

variable "env" {
  description = "Deployment environment. Used for log group naming and tags."
  type        = string
}

variable "tags" {
  description = "Additional resource tags merged with module defaults."
  type        = map(string)
  default     = {}
}
