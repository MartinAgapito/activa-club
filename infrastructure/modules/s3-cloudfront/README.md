# Módulo Terraform: s3-cloudfront

Crea un bucket S3 para assets estáticos y una distribución CloudFront para entrega de contenido.

## Advertencia de Costos

CloudFront ofrece 1 TB de transferencia de datos de salida y 10 millones de requests HTTP por mes gratis.
S3 ofrece 5 GB de almacenamiento estándar gratis. Las subidas de imágenes y documentos pueden superar este límite.
Monitorear el uso de almacenamiento S3 en CloudWatch.

## Entradas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `bucket_name` | string | Nombre del bucket S3 (debe ser globalmente único) |
| `environment` | string | Tag de ambiente |
| `cloudfront_price_class` | string | Clase de precio de CloudFront (default: `PriceClass_100` para US/EU) |
| `spa_index_document` | string | Documento fallback de la SPA (default: `index.html`) |
| `tags` | map(string) | Tags de recursos AWS |

## Salidas

| Salida | Descripción |
|--------|-------------|
| `bucket_name` | Nombre del bucket S3 |
| `bucket_arn` | ARN del bucket S3 |
| `cloudfront_domain_name` | Dominio de la distribución CloudFront |
| `cloudfront_distribution_id` | Usado para invalidaciones de caché |

## Enrutamiento SPA

Las respuestas de error personalizadas de CloudFront redirigen los errores 403 y 404 a `/index.html` con status 200, permitiendo que la navegación del lado del cliente de React Router funcione correctamente.

## Buckets Creados por Este Módulo

| Propósito | Contenido |
|-----------|-----------|
| SPA Frontend | App React compilada (index.html, bundles JS/CSS) |
| Imágenes de Áreas | Fotos de áreas recreativas subidas por el Admin |
| Imágenes de Promociones | Banners de promociones |
