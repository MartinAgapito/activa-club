# Terraform Module: s3-cloudfront

Creates an S3 bucket for static assets and a CloudFront distribution for content delivery.

## Cost Warning

CloudFront provides 1 TB of data transfer out and 10 million HTTP requests per month free.
S3 provides 5 GB of standard storage free. Asset uploads (images, documents) can exceed this.
Monitor S3 storage usage in CloudWatch.

## Inputs

| Variable              | Type         | Description                                           |
|-----------------------|--------------|-------------------------------------------------------|
| `bucket_name`         | string       | S3 bucket name (must be globally unique)              |
| `environment`         | string       | Environment tag                                       |
| `cloudfront_price_class` | string   | CloudFront price class (default: `PriceClass_100` for US/EU) |
| `spa_index_document`  | string       | SPA fallback document (default: `index.html`)         |
| `tags`                | map(string)  | AWS resource tags                                     |

## Outputs

| Output                  | Description                              |
|-------------------------|------------------------------------------|
| `bucket_name`           | S3 bucket name                           |
| `bucket_arn`            | S3 bucket ARN                            |
| `cloudfront_domain_name`| CloudFront distribution domain           |
| `cloudfront_distribution_id` | Used for cache invalidations       |

## SPA Routing

CloudFront custom error responses redirect 403 and 404 errors to `/index.html` with a 200 status,
enabling React Router client-side navigation to work correctly.

## Buckets Created by This Module

| Bucket Purpose        | Content                                          |
|-----------------------|--------------------------------------------------|
| Frontend SPA          | Built React app (index.html, JS, CSS bundles)    |
| Area Images           | Recreational area photos uploaded by Admin       |
| Promotion Images      | Promotion banner images                          |
