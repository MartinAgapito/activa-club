# Módulo Terraform: lambda

Crea una función AWS Lambda con su rol de ejecución, grupo de logs CloudWatch y, opcionalmente, una política para SSM Parameter Store.

## Entradas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `function_name` | string | Nombre de la función Lambda |
| `handler` | string | Ruta del handler (ej. `dist/handler.handler`) |
| `runtime` | string | Runtime de Lambda (default: `nodejs20.x`) |
| `s3_bucket` | string | Bucket S3 que contiene el paquete de despliegue |
| `s3_key` | string | Clave del objeto S3 del paquete zip |
| `memory_size` | number | MB de memoria (default: 256) |
| `timeout` | number | Segundos (default: 30) |
| `environment_variables` | map(string) | Variables de entorno de la Lambda |
| `dynamodb_table_arns` | list(string) | Tablas sobre las que la Lambda necesita acceso lectura/escritura |
| `sns_topic_arns` | list(string) | Tópicos SNS a los que la Lambda puede publicar (opcional) |
| `ssm_parameter_paths` | list(string) | Rutas SSM que la Lambda puede leer (opcional) |
| `tags` | map(string) | Tags de recursos AWS |

## Salidas

| Salida | Descripción |
|--------|-------------|
| `function_arn` | ARN de la función Lambda |
| `function_name` | Nombre de la función Lambda |
| `invoke_arn` | ARN usado por API Gateway para invocar la Lambda |

## Estrategia IAM

El módulo genera una política inline de mínimo privilegio que otorga:
- Acciones DynamoDB sobre los `dynamodb_table_arns` especificados únicamente
- `sns:Publish` sobre los `sns_topic_arns` especificados únicamente
- `ssm:GetParameter` sobre los `ssm_parameter_paths` especificados únicamente
- Acceso de escritura a CloudWatch Logs (grupo de logs auto-generado)
