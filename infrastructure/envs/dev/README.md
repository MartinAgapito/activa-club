# Environment: dev

Terraform overlay for the `dev` environment.

## Files

| File                | Purpose                                              |
|---------------------|------------------------------------------------------|
| `main.tf`           | Module instantiations wired to dev-specific vars     |
| `variables.tf`      | Variable declarations                                |
| `outputs.tf`        | Outputs (API URL, Cognito IDs, CloudFront domain)    |
| `terraform.tfvars`  | Non-secret variable values for dev (committed)       |

## First-Time Setup

```bash
# 1. Configure AWS credentials
export AWS_PROFILE=activaclub-dev

# 2. Initialize Terraform
terraform init

# 3. Review plan
terraform plan -var-file="terraform.tfvars"

# 4. Apply
terraform apply -var-file="terraform.tfvars"
```

## Secrets

Do NOT store secrets in `terraform.tfvars`.
Stripe keys and other secrets are stored in AWS SSM Parameter Store and retrieved at Lambda runtime.
To seed SSM parameters:

```bash
aws ssm put-parameter \
  --name "/activa-club/dev/stripe-secret-key" \
  --value "sk_test_..." \
  --type SecureString
```
