# Infrastructure - ActivaClub

Terraform IaC for all AWS resources powering ActivaClub.
No resource is created via the AWS Console. Everything is defined here.

## Cost Warning

The following services are within AWS Free Tier for expected thesis workloads:
- Lambda: 1M requests/month free
- DynamoDB: 25 GB storage, 25 WCU/RCU provisioned free
- API Gateway HTTP API: 1M requests/month free
- Cognito: 50,000 MAU free
- SNS: 1M publishes/month free

Services that MAY generate cost:
- CloudFront: 1 TB/month free, but invalidations > 1000/month are charged.
- S3: 5 GB free; images/uploads can exceed this quickly.
- ACM (SSL Certificates): Free when used with CloudFront/ALB.

## Directory Layout

```
infrastructure/
├── modules/                  # Reusable Terraform modules
│   ├── dynamodb/             # DynamoDB tables + GSIs
│   ├── lambda/               # Lambda function + IAM role
│   ├── api-gateway/          # HTTP API + routes + integrations + authorizer
│   ├── cognito/              # User Pool + App Client + Groups
│   ├── sns/                  # SNS topics + subscriptions
│   └── s3-cloudfront/        # S3 bucket + CloudFront distribution
├── envs/
│   └── dev/                  # Dev environment overlay
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── terraform.tfvars
└── README.md
```

## Module Overview

| Module         | Resources Created                                       |
|----------------|---------------------------------------------------------|
| `dynamodb`     | DynamoDB table with GSIs, TTL, point-in-time recovery   |
| `lambda`       | Lambda function, IAM role, CloudWatch log group         |
| `api-gateway`  | HTTP API, JWT authorizer (Cognito), routes, stages      |
| `cognito`      | User Pool, App Client, Groups (Admin/Manager/Member)    |
| `sns`          | Promotions topic, optional email subscriptions          |
| `s3-cloudfront`| S3 bucket (frontend SPA + assets), CloudFront distro    |

## Usage

```bash
cd infrastructure/envs/dev
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

## Naming Conventions

| Resource       | Pattern                                          |
|----------------|--------------------------------------------------|
| Lambda         | `activa-club-<service>-<env>`                    |
| DynamoDB table | `<PascalCase>Table-<env>`                        |
| IAM role       | `activa-club-<service>-role-<env>`               |
| SNS topic      | `activa-club-<topic>-<env>`                      |
| S3 bucket      | `activa-club-<purpose>-<account_id>-<env>`       |

## State Backend (recommended for team)

Configure remote state in each env's `main.tf`:
```hcl
terraform {
  backend "s3" {
    bucket         = "activa-club-tfstate-<account_id>"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "activa-club-tfstate-lock"
  }
}
```
This S3 bucket is NOT provisioned by this repo. Create it manually once before first apply.

## Least-Privilege IAM

Each Lambda has its own IAM role granting only:
- `dynamodb:GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` on its own table(s)
- `ssm:GetParameter` for secrets retrieval
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- Service-specific: `sns:Publish` for promotions Lambda, `s3:PutObject` for admin Lambda
