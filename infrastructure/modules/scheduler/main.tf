# ============================================================
# modules/scheduler/main.tf
#
# Creates an EventBridge Scheduler schedule that invokes a
# Lambda function on a fixed rate or cron expression.
#
# Resources:
#   - aws_scheduler_schedule       — the schedule itself
#   - aws_iam_role                 — role assumed by the scheduler
#   - aws_iam_role_policy          — allows the scheduler to invoke the Lambda
#   - aws_lambda_permission        — grants the scheduler service invoke rights
# ============================================================

locals {
  common_tags = merge(var.tags, {
    Environment = var.env
    ManagedBy   = "terraform"
  })
}

# ------------------------------------------------------------
# IAM Role — assumed by the EventBridge Scheduler service
# ------------------------------------------------------------
resource "aws_iam_role" "scheduler" {
  name = "${var.schedule_name}-role-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name = "${var.schedule_name}-invoke-${var.env}"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = var.target_lambda_arn
    }]
  })
}

# ------------------------------------------------------------
# Lambda Permission — allows scheduler.amazonaws.com to call
# the target Lambda (required in addition to the IAM role).
# ------------------------------------------------------------
resource "aws_lambda_permission" "scheduler_invoke" {
  statement_id  = "AllowEventBridgeScheduler"
  action        = "lambda:InvokeFunction"
  function_name = var.target_lambda_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.this.arn
}

# ------------------------------------------------------------
# EventBridge Scheduler
# ------------------------------------------------------------
resource "aws_scheduler_schedule" "this" {
  name       = "${var.schedule_name}-${var.env}"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = var.schedule_expression

  target {
    arn      = var.target_lambda_arn
    role_arn = aws_iam_role.scheduler.arn
    input    = var.target_input
  }

  tags = local.common_tags
}
