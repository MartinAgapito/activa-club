# ============================================================
# modules/s3-cloudfront/outputs.tf
# ============================================================

output "bucket_name" {
  description = "S3 bucket name for frontend assets."
  value       = aws_s3_bucket.frontend.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.frontend.arn
}

output "bucket_id" {
  description = "S3 bucket ID (same as name). Used in other resource references."
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain (e.g. d1234abcd.cloudfront.net). Use as CORS origin and VITE_API_BASE_URL host."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID. Required by CI/CD to run cache invalidations after each deploy."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN."
  value       = aws_cloudfront_distribution.frontend.arn
}
