# ============================================================
# modules/s3-cloudfront/main.tf
#
# Creates an S3 bucket for the React SPA and a CloudFront
# distribution that serves it globally. Uses OAC (Origin Access
# Control) — the recommended replacement for legacy OAI.
#
# SPA routing: 403 and 404 responses from S3 are rewritten to
# /index.html with HTTP 200 so React Router works correctly.
# ============================================================

# ── S3 Bucket ────────────────────────────────────────────────

resource "aws_s3_bucket" "frontend" {
  bucket = var.bucket_name

  tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Block all public access — CloudFront OAC is the only allowed reader
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── CloudFront Origin Access Control ─────────────────────────

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.bucket_name}-oac"
  description                       = "OAC for ${var.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront Distribution ───────────────────────────────────

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = var.spa_index_document
  price_class         = var.cloudfront_price_class
  comment             = "${var.bucket_name} SPA"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${var.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA routing: rewrite S3 403/404 to /index.html so React Router works
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/${var.spa_index_document}"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/${var.spa_index_document}"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# ── S3 Bucket Policy ─────────────────────────────────────────
# Allows the CloudFront distribution to read objects via OAC.

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}
