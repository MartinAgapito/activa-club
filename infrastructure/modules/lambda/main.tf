# ============================================================
# modules/lambda/main.tf
#
# Creates a Lambda function with:
#   - IAM execution role (least-privilege inline policy)
#   - CloudWatch Log Group (7-day retention — free tier friendly)
#   - Deployment package sourced from S3
#
# IAM policy covers:
#   - CloudWatch Logs (always granted via AWS managed policy)
#   - DynamoDB read/write on specified tables + their indexes
#   - Cognito admin API calls on specified User Pools
#   - SNS Publish on specified topics
#   - SSM GetParameter on specified paths
# ============================================================

locals {
  has_dynamodb = length(var.dynamodb_table_arns) > 0
  has_cognito  = length(var.cognito_user_pool_arns) > 0 && length(var.cognito_actions) > 0
  has_sns      = length(var.sns_topic_arns) > 0
  has_ssm      = length(var.ssm_parameter_paths) > 0
  has_custom_policy = local.has_dynamodb || local.has_cognito || local.has_sns || local.has_ssm

  common_tags = merge(var.tags, {
    Environment = var.env
    ManagedBy   = "terraform"
  })
}

# ------------------------------------------------------------
# IAM Execution Role
# ------------------------------------------------------------
resource "aws_iam_role" "this" {
  name = "${var.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

# Basic CloudWatch Logs permission (create log group, put log events)
resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ------------------------------------------------------------
# Inline Policy — DynamoDB, Cognito, SNS, SSM
# Created only when at least one resource type is specified.
# ------------------------------------------------------------
resource "aws_iam_role_policy" "custom" {
  count = local.has_custom_policy ? 1 : 0

  name = "${var.function_name}-policy"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(

      # DynamoDB — full CRUD on tables + their GSI/LSI indexes
      local.has_dynamodb ? [{
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
        ]
        Resource = concat(
          var.dynamodb_table_arns,
          [for arn in var.dynamodb_table_arns : "${arn}/index/*"]
        )
      }] : [],

      # Cognito — admin API calls scoped to specific User Pools
      local.has_cognito ? [{
        Sid      = "CognitoAdminAccess"
        Effect   = "Allow"
        Action   = var.cognito_actions
        Resource = var.cognito_user_pool_arns
      }] : [],

      # SNS — publish to specific topics only
      local.has_sns ? [{
        Sid      = "SNSPublish"
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = var.sns_topic_arns
      }] : [],

      # SSM Parameter Store — read specific parameter paths
      local.has_ssm ? [{
        Sid    = "SSMGetParameters"
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = [
          for path in var.ssm_parameter_paths :
          "arn:aws:ssm:*:*:parameter${path}"
        ]
      }] : []
    )
  })
}

# ------------------------------------------------------------
# CloudWatch Log Group
# Pre-creating the log group lets us control retention.
# Without this, Lambda auto-creates it with infinite retention.
# ------------------------------------------------------------
resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 7 # Keeps costs within free tier

  tags = local.common_tags
}

# ------------------------------------------------------------
# Lambda Function
# ------------------------------------------------------------
resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = aws_iam_role.this.arn
  handler       = var.handler
  runtime       = var.runtime
  memory_size   = var.memory_size
  timeout       = var.timeout

  # Deployment package — uploaded to S3 by the CI/CD pipeline
  s3_bucket = var.s3_bucket
  s3_key    = var.s3_key

  environment {
    variables = var.environment_variables
  }

  # Ensure the log group exists before the function first fires
  depends_on = [
    aws_cloudwatch_log_group.this,
    aws_iam_role_policy_attachment.basic_execution,
  ]

  tags = local.common_tags
}
