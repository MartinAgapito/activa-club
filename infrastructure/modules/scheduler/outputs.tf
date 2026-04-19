# ============================================================
# modules/scheduler/outputs.tf
# ============================================================

output "schedule_arn" {
  description = "ARN of the EventBridge Scheduler schedule."
  value       = aws_scheduler_schedule.this.arn
}

output "schedule_name" {
  description = "Full name of the EventBridge Scheduler schedule (includes environment suffix)."
  value       = aws_scheduler_schedule.this.name
}

output "scheduler_role_arn" {
  description = "ARN of the IAM role assumed by the EventBridge Scheduler to invoke the target Lambda."
  value       = aws_iam_role.scheduler.arn
}
