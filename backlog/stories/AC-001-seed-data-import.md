# AC-001: Importación de Datos Seed desde Sistema Legado

**Epic:** EP-01 - Incorporación de Socios
**Prioridad:** Alta
**Story Points:** 3
**Estado:** Backlog
**Autor:** Agente Senior Product Owner

---

## Historia de Usuario

Como administrador del sistema,
Quiero importar los datos de socios existentes al sistema nuevo,
Para que el proceso de registro DNI pueda validar contra datos reales del club.

---

## Valor de Negocio

Sin los datos del sistema legado importados, ningún socio puede registrarse en la plataforma.
Este script es el prerequisito absoluto de todo el flujo de onboarding.
Garantiza que la migración desde el sistema on-premise sea controlada, auditable y repetible,
preservando la integridad de los registros históricos del club.

---

## Personas Involucradas

| Persona       | Rol   | Interacción                                                      |
|---------------|-------|------------------------------------------------------------------|
| Administrador | Admin | Ejecuta el script con el archivo CSV/JSON del sistema on-premise |

---

## Precondiciones

- Acceso al archivo CSV/JSON exportado del sistema legado.
- Tabla `SeedMembersTable` ya aprovisionada en DynamoDB (Terraform aplicado).
- Credenciales AWS configuradas en el ambiente de ejecución del script.

---

## Criterios de Aceptación

- [ ] Script `scripts/seed-legacy-members.ts` ejecutable desde CLI con un argumento de ruta al archivo de entrada.
- [ ] Lee un archivo CSV/JSON con los campos: `dni`, `full_name`, `membership_type`, `account_status`.
- [ ] Inserta cada registro en `SeedMembersTable` con PK = `DNI` (string, valor plano, sin prefijo).
- [ ] Registros con `account_status` con valor inválido son omitidos y se registra un log de advertencia indicando el DNI afectado.
- [ ] Al finalizar la ejecución, imprime un resumen con tres contadores: insertados / omitidos / errores.
- [ ] La ejecución es idempotente: correr el script más de una vez con el mismo archivo no genera registros duplicados (upsert mediante `PutItem` con sobreescritura).

---

## Fuera de Alcance

- Interfaz gráfica para la importación — el script CLI es suficiente para el MVP.
- Validación avanzada de formato DNI — diferida a historia de validaciones post-MVP.
- Importación incremental automática — diferida a historia de sincronización post-MVP.

---

## Reglas de Negocio

- **PK de DynamoDB:** El campo `DNI` se almacena como string plano sin prefijo (e.g., `"12345678"` y no `"DNI#12345678"`).
- **Idempotencia:** La re-ejecución no debe duplicar registros. Se usa `PutItem` con sobreescritura.
- **Omisión con log:** Los registros inválidos no interrumpen la ejecución; se omiten y se registra una advertencia.
- **BatchWriteItem:** Se usa `BatchWriteItem` de DynamoDB para eficiencia en datasets grandes.

---

## Dependencias

| Historia / Artefacto | Motivo                                                              |
|----------------------|---------------------------------------------------------------------|
| AC-002               | El endpoint de registro valida el DNI contra `SeedMembersTable`.    |
| Terraform (IaC)      | La tabla `SeedMembersTable` debe existir antes de ejecutar el script. |

---

## Definition of Done

- [ ] Script `scripts/seed-legacy-members.ts` ejecutado exitosamente en ambiente dev con un dataset de prueba.
- [ ] Tabla `SeedMembersTable` poblada y verificada mediante consulta directa en DynamoDB.
- [ ] Resumen de ejecución (insertados / omitidos / errores) documentado en el reporte de prueba.
- [ ] Idempotencia verificada: segunda ejecución con el mismo archivo no genera duplicados.
- [ ] Código del script revisado y aprobado.

---

## Notas Técnicas

- **Design Doc:** `docs/design/AC-001-design.md` (sección SeedMembersTable)
- DynamoDB PK = `DNI` (string, valor plano).
- Usar `BatchWriteItem` para eficiencia en lotes de hasta 25 ítems.
