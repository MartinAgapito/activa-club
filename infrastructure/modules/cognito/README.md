# Terraform Module: cognito

Creates an Amazon Cognito User Pool with:
- App Client (no secret, for SPA use with PKCE)
- Groups: `Admin`, `Manager`, `Member`
- Password policy and MFA configuration
- Optional Lambda triggers (post-confirmation, pre-token-generation)

## Inputs

| Variable                    | Type         | Description                                    |
|-----------------------------|--------------|------------------------------------------------|
| `user_pool_name`            | string       | Cognito User Pool name                         |
| `app_client_name`           | string       | App Client name                                |
| `allowed_callback_urls`     | list(string) | OAuth callback URLs (for hosted UI if used)    |
| `allowed_logout_urls`       | list(string) | OAuth logout URLs                              |
| `post_confirmation_lambda_arn` | string    | Lambda triggered after user confirms email (optional) |
| `tags`                      | map(string)  | AWS resource tags                              |

## Outputs

| Output              | Description                              |
|---------------------|------------------------------------------|
| `user_pool_id`      | Cognito User Pool ID                     |
| `user_pool_arn`     | Cognito User Pool ARN                    |
| `client_id`         | App Client ID                            |
| `issuer_url`        | JWT issuer URL for API Gateway authorizer|

## Groups

| Group Name | Description                                    |
|------------|------------------------------------------------|
| `Admin`    | Full platform access                           |
| `Manager`  | Promotions management, reports                 |
| `Member`   | Standard member self-service                   |

## Token Claims

The `pre-token-generation` Lambda trigger (if configured) can add custom claims
such as `memberId` and `membershipTier` to the Cognito ID token, eliminating
the need for an extra DynamoDB lookup in protected endpoints.
