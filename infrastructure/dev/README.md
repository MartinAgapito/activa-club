# infrastructure/dev

DEV environment Terraform configuration for ActivaClub.

This folder is **completely isolated** from `envs/production/`. It targets a
separate AWS account via `assume_role` and stores its state in a dedicated S3
bucket (`ac-tfstate-dev`) and DynamoDB lock table (`ac-tflock-dev`).

---

## Prerequisites — one-time DEV backend bootstrap

The S3 bucket and DynamoDB table used as the Terraform backend **must exist
before running `terraform init`**. Create them once in your DEV account with
the AWS CLI (or a short Terraform bootstrap similar to `infrastructure/bootstrap/`):

```bash
# Authenticate against the DEV account first (profile, SSO, etc.)
export AWS_PROFILE=activaclub-dev   # adjust to your local profile name

# 1. Create the state bucket
aws s3api create-bucket \
  --bucket ac-tfstate-dev \
  --region us-east-1

# 2. Enable versioning
aws s3api put-bucket-versioning \
  --bucket ac-tfstate-dev \
  --versioning-configuration Status=Enabled

# 3. Enable default encryption (AES-256, free)
aws s3api put-bucket-encryption \
  --bucket ac-tfstate-dev \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# 4. Block all public access
aws s3api put-public-access-block \
  --bucket ac-tfstate-dev \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 5. Create the DynamoDB lock table
aws dynamodb create-table \
  --table-name ac-tflock-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --sse-specification Enabled=true \
  --region us-east-1
```

---

## IAM role in the DEV account

The provider is configured to assume
`arn:aws:iam::<dev_account_id>:role/activa-club-terraform-dev-role`.

Create this role in the DEV account and attach a policy equivalent to
`activa-club-cicd-terraform-policy` (see `infrastructure/bootstrap/iam-cicd.tf`),
scoped to the DEV account resources.

---

## First-time init and apply

```bash
# Copy and fill in the variable values
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set dev_account_id at minimum

terraform init
terraform plan
terraform apply
```

---

## Resource naming

All resources created here carry the `-dev` suffix:

| Resource              | Name                          |
|-----------------------|-------------------------------|
| DynamoDB members      | `MembersTable-dev`            |
| DynamoDB seed members | `SeedMembersTable-dev`        |
| Cognito User Pool     | `activa-club-dev`             |
| TF state bucket       | `ac-tfstate-dev`              |
| TF lock table         | `ac-tflock-dev`               |
