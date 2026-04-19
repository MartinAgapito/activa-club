# ============================================================
# modules/api-gateway/main.tf
#
# Creates an Amazon API Gateway HTTP API with:
#   - CORS configuration for frontend origins
#   - JWT Authorizer backed by Amazon Cognito
#   - One Lambda integration per unique invoke ARN
#   - Per-route authorization (JWT or NONE)
#   - $default stage with auto-deploy
#   - CloudWatch access log group (7-day retention)
#   - Lambda invoke permissions for API Gateway
# ============================================================

locals {
  common_tags = merge(var.tags, {
    Environment = var.env
    ManagedBy   = "terraform"
  })

  # Build a map of unique function names → routes that use each Lambda.
  # API Gateway requires one integration per Lambda target.
  # Key by function_name (known at plan time) — invoke_arn is computed and
  # cannot be used as a for_each key when the Lambda doesn't exist yet.
  unique_lambdas = {
    for r in var.routes : r.lambda_function_name => r...
  }

  # Build a map keyed by "METHOD /path" for route resources.
  routes_map = {
    for r in var.routes : "${r.method} ${r.path}" => r
  }
}

# ------------------------------------------------------------
# HTTP API
# ------------------------------------------------------------
resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  protocol_type = "HTTP"
  description   = "ActivaClub API Gateway — ${var.env}"

  cors_configuration {
    allow_origins  = var.cors_origins
    allow_methods  = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers  = ["Content-Type", "Authorization", "X-Request-ID", "X-Amz-Date", "X-Api-Key"]
    expose_headers = ["X-Request-ID"]
    max_age        = 300
  }

  tags = local.common_tags
}

# ------------------------------------------------------------
# JWT Authorizer — validates Cognito IdTokens on every
# protected route ($request.header.Authorization)
# ------------------------------------------------------------
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.this.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt-authorizer"

  jwt_configuration {
    audience = var.cognito_audience
    issuer   = var.cognito_issuer_url
  }
}

# ------------------------------------------------------------
# Lambda Integrations — one per unique Lambda invoke ARN
# ------------------------------------------------------------
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = local.unique_lambdas

  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value[0].lambda_invoke_arn # invoke_arn is fine as a value
  payload_format_version = "2.0"                           # HTTP API format (smaller payload, faster)
}

# ------------------------------------------------------------
# Routes — one per route definition
# Public routes (auth_required = false) use NONE authorization.
# Protected routes (auth_required = true) use the JWT authorizer.
# ------------------------------------------------------------
resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes_map

  api_id    = aws_apigatewayv2_api.this.id
  route_key = each.key # "POST /v1/auth/register"

  target = "integrations/${aws_apigatewayv2_integration.lambda[each.value.lambda_function_name].id}"

  authorization_type = each.value.auth_required ? "JWT" : "NONE"
  authorizer_id      = each.value.auth_required ? aws_apigatewayv2_authorizer.jwt.id : null
}

# ------------------------------------------------------------
# $default Stage — auto-deploys on every change
# ------------------------------------------------------------
resource "aws_cloudwatch_log_group" "access_logs" {
  name              = "/aws/apigateway/${var.api_name}"
  retention_in_days = 7

  tags = local.common_tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      sourceIp       = "$context.identity.sourceIp"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      durationMs     = "$context.responseLatency"
      authError      = "$context.authorizer.error"
    })
  }

  tags = local.common_tags
}

# ------------------------------------------------------------
# Lambda Invoke Permissions
# Grants API Gateway permission to invoke each Lambda function.
# source_arn is scoped to this specific API to follow least privilege.
# ------------------------------------------------------------
resource "aws_lambda_permission" "apigw_invoke" {
  for_each = {
    for r in var.routes :
    "${r.method}_${replace(r.path, "/", "_")}" => r
  }

  statement_id  = "AllowAPIGatewayInvoke-${replace(each.key, "/[^a-zA-Z0-9_-]/", "_")}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  # Scope permission to this API only (all stages, all routes)
  source_arn = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
