# Terraform Module: lambda

Creates an AWS Lambda function with its execution role, CloudWatch log group, and optionally an SSM parameter policy.

## Inputs

| Variable              | Type         | Description                                       |
|-----------------------|--------------|---------------------------------------------------|
| `function_name`       | string       | Lambda function name                              |
| `handler`             | string       | Handler path (e.g., `dist/handler.handler`)       |
| `runtime`             | string       | Lambda runtime (default: `nodejs20.x`)            |
| `s3_bucket`           | string       | S3 bucket containing the deployment package       |
| `s3_key`              | string       | S3 object key for the zip package                 |
| `memory_size`         | number       | MB of memory (default: 256)                       |
| `timeout`             | number       | Seconds (default: 30)                             |
| `environment_variables` | map(string) | Lambda environment variables                     |
| `dynamodb_table_arns` | list(string) | Tables this Lambda needs read/write access to     |
| `sns_topic_arns`      | list(string) | SNS topics this Lambda can publish to (optional)  |
| `ssm_parameter_paths` | list(string) | SSM paths this Lambda can read (optional)         |
| `tags`                | map(string)  | AWS resource tags                                 |

## Outputs

| Output           | Description              |
|------------------|--------------------------|
| `function_arn`   | Lambda function ARN      |
| `function_name`  | Lambda function name     |
| `invoke_arn`     | ARN used by API Gateway  |

## IAM Policy Strategy

The module generates a least-privilege inline policy granting:
- DynamoDB actions on specified `dynamodb_table_arns` only
- SNS `Publish` on specified `sns_topic_arns` only
- SSM `GetParameter` on specified `ssm_parameter_paths` only
- CloudWatch Logs write access (auto-generated log group)
