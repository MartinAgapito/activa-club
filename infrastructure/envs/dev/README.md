# Environment: dev

Terraform overlay for the `dev` environment. Targets a separate AWS account
from production so that experiments never risk production data.

## Files

| File                        | Purpose                                                        |
|-----------------------------|----------------------------------------------------------------|
| `main.tf`                   | Module instantiations wired to dev-specific vars               |
| `variables.tf`              | Variable declarations                                          |
| `outputs.tf`                | Outputs (table names/ARNs, Cognito IDs)                        |
| `terraform.tfvars.example`  | Template for local variable values — copy to terraform.tfvars  |

## Prerequisites

The remote backend bucket and lock table do not exist yet in the DEV account.
Create them once with the AWS CLI before running `terraform init`:

```bash
# 1. Create the S3 state bucket (versioning + encryption)
aws s3api create-bucket \
  --bucket ac-tfstate-dev \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket ac-tfstate-dev \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket ac-tfstate-dev \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket ac-tfstate-dev \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 2. Create the DynamoDB lock table
aws dynamodb create-table \
  --table-name ac-tflock-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## First-Time Setup

```bash
# 1. Copy the example vars file and fill in your DEV account ID
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set dev_account_id to your DEV AWS account

# 2. Ensure your local session can assume the DEV role
#    (e.g. export AWS_PROFILE=<profile-that-can-assume-the-dev-role>)

# 3. Initialize Terraform
terraform init

# 4. Review plan
terraform plan -var-file="terraform.tfvars"

# 5. Apply
terraform apply -var-file="terraform.tfvars"
```

## IAM Role Required in DEV Account

The provider assumes `arn:aws:iam::<dev_account_id>:role/activa-club-terraform-dev-role`.
That role must exist in the DEV account and must trust the identity running Terraform
(e.g. your IAM user or SSO session ARN from the PRD account).

Minimum permissions needed on the role:
- `dynamodb:*` (scoped to table ARNs in the DEV account)
- `cognito-idp:*` (scoped to the DEV user pool)
- `s3:*` on `ac-tfstate-dev`
- `dynamodb:*` on `ac-tflock-dev`

## Secrets

Do NOT store secrets in `terraform.tfvars`.
API keys and other secrets are stored in AWS SSM Parameter Store and retrieved at Lambda runtime.
To seed SSM parameters:

```bash
aws ssm put-parameter \
  --name "/activa-club/dev/stripe-secret-key" \
  --value "sk_test_..." \
  --type SecureString
```
