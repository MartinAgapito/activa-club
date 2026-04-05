# Scripts — ActivaClub

Utilidades de seed, importación de datos y tareas administrativas.

## Contenido

| Script | Propósito |
|--------|-----------|
| `seed-legacy-members.ts` | Importar datos de socios pre-existentes a `SeedMembersTable` |
| `seed-areas.ts` | Sembrar áreas recreativas iniciales en `AreasTable` |
| `seed-dev-users.ts` | Crear usuarios de prueba en Cognito para desarrollo local |
| `export-members.ts` | Exportar lista de socios a JSON para reportes |

## Requisitos Previos

Antes de ejecutar cualquier script desde tu máquina local:

1. **Node.js** — versión 18 o superior (`node -v` para verificar)
2. **Credenciales AWS** — configuradas vía `aws configure` o perfil con nombre (`~/.aws/credentials`)
3. **Dependencias instaladas:**

```bash
cd scripts
npm install
```

## Ejecución

```bash
cd scripts
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json
```

## Importación de Datos Legados (seed-legacy-members.ts)

Lee un array JSON de registros de socios pre-existentes y escribe cada uno en `SeedMembersTable-<env>`. Es la **precondición de AC-001**: el flujo de registro valida cada DNI contra esta tabla antes de crear el usuario en Cognito.

### Comportamiento

1. Carga y valida cada registro del archivo JSON.
2. Escribe cada registro válido con `PutItem` (upsert — los registros existentes se sobreescriben).
3. Saltea registros inválidos con una advertencia; no interrumpe el resto de la importación.
4. Imprime progreso por registro y un resumen final (insertados / salteados / errores).
5. Sale con código `1` si ocurrió algún error de validación o escritura.

### Formato JSON

```json
[
  {
    "dni":            "20345678",
    "firstName":      "Juan",
    "lastName":       "Pérez",
    "membershipTier": "Gold",
    "email":          "juan.perez@email.com",
    "phone":          "+5491112345678",
    "accountStatus":  "active"
  }
]
```

| Campo | Requerido | Valores | Notas |
|-------|-----------|---------|-------|
| `dni` | sí | 7–8 dígitos numéricos | |
| `firstName` | sí | string | |
| `lastName` | sí | string | |
| `membershipTier` | sí | `VIP` \| `Gold` \| `Silver` | sin distinción de mayúsculas |
| `email` | no | string | almacenado en minúsculas |
| `phone` | no | string | |
| `accountStatus` | sí | `active` \| `inactive` | valor inválido → registro salteado |

### Opciones

```
--env <env>      Deriva el nombre de tabla como SeedMembersTable-<env>
--table <name>   Nombre explícito de la tabla DynamoDB (sobreescribe --env)
--file <path>    Ruta al archivo JSON (requerido)
--region <r>     Región AWS (default: us-east-1)
--profile <p>    Perfil nombrado de AWS CLI
--dry-run        Validar sin escribir en DynamoDB
```

### Ejemplos

```bash
# Validar primero sin escribir
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json --dry-run

# Ejecutar contra el ambiente dev con perfil AWS local
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json --profile activaclub-dev

# Nombre de tabla explícito
npx ts-node seed-legacy-members.ts --table SeedMembersTable-dev --file ./data/legacy-members.json
```

## Configuración de Ambiente

Los scripts leen la configuración AWS desde variables de entorno o `~/.aws/credentials`.
Los nombres de tablas se derivan de `--env` (ej. `SeedMembersTable-dev`) o se pasan explícitamente vía `--table`.
