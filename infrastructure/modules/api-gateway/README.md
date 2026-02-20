# Terraform Module: api-gateway

Creates an Amazon API Gateway HTTP API with:
- A JWT authorizer backed by Amazon Cognito
- Route definitions mapping HTTP method + path to Lambda integrations
- Stage deployment (default: `$default` for HTTP APIs)
- CloudWatch access logging

## Inputs

| Variable             | Type         | Description                                       |
|----------------------|--------------|---------------------------------------------------|
| `api_name`           | string       | API Gateway name                                  |
| `cognito_issuer_url` | string       | Cognito User Pool issuer URL for JWT authorizer   |
| `cognito_audience`   | list(string) | Cognito App Client IDs                            |
| `routes`             | list(object) | Route definitions (method, path, lambda_invoke_arn, auth_required) |
| `cors_origins`       | list(string) | Allowed CORS origins                              |
| `stage_name`         | string       | Stage name (default: `dev`)                       |
| `tags`               | map(string)  | AWS resource tags                                 |

## Outputs

| Output        | Description                              |
|---------------|------------------------------------------|
| `api_id`      | API Gateway ID                           |
| `api_endpoint`| Base URL for the API                     |

## Route Convention

All routes follow the pattern: `<METHOD> /v1/<resource>`

The Stripe webhook route (`POST /v1/payments/webhook`) is configured without the JWT authorizer
to allow Stripe to call it without a Cognito token. Stripe request signature verification
is handled inside the Lambda.

## CORS Configuration

CORS is configured at the API Gateway level for the frontend CloudFront domain.
In dev, `http://localhost:5173` is added to allowed origins.
