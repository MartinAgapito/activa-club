# ============================================================
# modules/s3-cloudfront/variables.tf
# ============================================================

variable "bucket_name" {
  description = "S3 bucket name for the frontend SPA. Must be globally unique."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, prd). Used for resource tagging."
  type        = string
}

variable "cloudfront_price_class" {
  description = "CloudFront price class. PriceClass_100 covers US, Canada and Europe — lowest cost option."
  type        = string
  default     = "PriceClass_100"
}

variable "spa_index_document" {
  description = "SPA fallback document served for 403/404 S3 errors. Enables client-side routing."
  type        = string
  default     = "index.html"
}

variable "tags" {
  description = "Additional tags to apply to all resources in this module."
  type        = map(string)
  default     = {}
}
