# Ambiente: production

Overlay Terraform para el ambiente `production`.

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `main.tf` | Instanciación de módulos con variables específicas de producción |
| `variables.tf` | Declaración de variables |
| `outputs.tf` | Outputs (URL del API, IDs de Cognito, dominio de CloudFront) |
| `terraform.tfvars` | Valores no secretos para producción (versionado en git) |

## Configuración Inicial

```bash
# 1. Configurar credenciales AWS
export AWS_PROFILE=activaclub-prd

# 2. Inicializar Terraform
terraform init

# 3. Revisar el plan
terraform plan -var-file="terraform.tfvars"

# 4. Aplicar
terraform apply -var-file="terraform.tfvars"
```

## Secretos

NO almacenar secretos en `terraform.tfvars`.
Las claves de Stripe y otros secretos se guardan en AWS SSM Parameter Store y se obtienen en runtime desde el Lambda.

```bash
aws ssm put-parameter \
  --name "/activa-club/prd/stripe-secret-key" \
  --value "sk_live_..." \
  --type SecureString
```
