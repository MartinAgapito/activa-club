# Librería: logging

Utilidad de logging estructurado para las funciones Lambda de ActivaClub.

## Diseño

Envuelve AWS Lambda PowerTools para TypeScript (`@aws-lambda-powertools/logger`) para proveer:
- Formato de log JSON consistente en todos los servicios
- Inyección automática de campos: `service`, `env`, `requestId` y `userId`
- Configuración del nivel de log vía variable de entorno `LOG_LEVEL`

## Uso

```typescript
import { createLogger } from '@activa-club/logging';

const logger = createLogger('members-service');
logger.info('Socio creado', { memberId: '123' });
logger.error('Error en DynamoDB', { error });
```

## Niveles de Log

`DEBUG | INFO | WARN | ERROR` — por defecto `INFO` en dev y `WARN` en producción.
