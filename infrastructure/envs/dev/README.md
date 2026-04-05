# Ambiente: dev

Overlay Terraform para el ambiente `dev`. Apunta a una cuenta AWS separada de producción para que los experimentos nunca pongan en riesgo los datos de producción.

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `main.tf` | Instanciación de módulos con variables específicas de dev |
| `variables.tf` | Declaración de variables |
| `outputs.tf` | Outputs (nombres/ARNs de tablas, IDs de Cognito) |
| `terraform.tfvars.example` | Plantilla de valores — copiar a terraform.tfvars |

## Requisitos Previos

El bucket de backend remoto y la tabla de lock no existen aún en la cuenta DEV.
Crearlos una sola vez con la AWS CLI antes de ejecutar `terraform init`:

```bash
# 1. Crear el bucket S3 de estado (con versionado y cifrado)
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

# 2. Crear la tabla DynamoDB de lock
aws dynamodb create-table \
  --table-name ac-tflock-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Configuración Inicial

```bash
# 1. Copiar el archivo de variables de ejemplo y completar el account ID de DEV
cp terraform.tfvars.example terraform.tfvars

# 2. Asegurarse de que la sesión local pueda asumir el rol DEV
#    (ej. export AWS_PROFILE=<profile-que-puede-asumir-el-rol-dev>)

# 3. Inicializar Terraform
terraform init

# 4. Revisar el plan
terraform plan -var-file="terraform.tfvars"

# 5. Aplicar
terraform apply -var-file="terraform.tfvars"
```

## Rol IAM Requerido en la Cuenta DEV

El provider asume `arn:aws:iam::<dev_account_id>:role/activa-club-terraform-dev-role`.
Ese rol debe existir en la cuenta DEV y debe confiar en la identidad que ejecuta Terraform.

Permisos mínimos necesarios en el rol:
- `dynamodb:*` (acotado a ARNs de tablas en la cuenta DEV)
- `cognito-idp:*` (acotado al User Pool DEV)
- `s3:*` en `ac-tfstate-dev`
- `dynamodb:*` en `ac-tflock-dev`

## Secretos

NO almacenar secretos en `terraform.tfvars`.
Las claves de API y otros secretos se guardan en AWS SSM Parameter Store y se obtienen en runtime desde el Lambda.

```bash
aws ssm put-parameter \
  --name "/activa-club/dev/stripe-secret-key" \
  --value "sk_test_..." \
  --type SecureString
```
