# Especificación Técnica — Módulo de Métricas y Cierre (`metrics`)

Contrato compartido de BD: [`docs/specs/especificaciones_de_base_de_datos.md`](../../../../../docs/specs/especificaciones_de_base_de_datos.md).
Spec de BD del módulo: [`backend/Modules/Metrics/specs/metrics_database_spec.md`](../../../../../backend/Modules/Metrics/specs/metrics_database_spec.md).
Spec de Cumplimiento: [`frontend/src/modules/compliance/specs/compliance.spec.md`](../../compliance/specs/compliance.spec.md).

---

## 1. Propósito y Alcance
Consolidar el seguimiento de coordinación, los insumos de resultados por unidad y la elaboración del **Reporte Semestral Final** dentro del módulo `metrics` (`frontend/src/modules/metrics/`) bajo Spec-Driven Development (SDD).

---

## 2. Catálogo de Formatos de Coordinación e Insumos (3 Archivos)

| `format_key` | Archivo oficial | Tipo | Mapeo `sheet_key` → nombre exacto de hoja |
| :--- | :--- | :--- | :--- |
| `ReporteSemestralCoordinador` | `REPORTE SEMESTRAL DEL COORNADOR  EDITABLE.xlsx` | Coordinación (2 pestañas) | `hoja1` → `hoja1` · `hoja2` → `hoja2` |
| `MatrizControlCoordinacion` | `tutores a-d 2026.xlsx` | Coordinación (4 pestañas) | `actividades` → `actividades` · `asesores` → `asesores` · `primero_y_tercero` → `1º y 3º` · `quinto_y_septimo` → `5º y 7º` |
| `ResultadosUnidadFinal` | `Resultados-por-unidad FINAL.xls` | Insumo externo (BIFF8 `.xls`) | `unit_results` → hoja por defecto (contraste estadístico de reprobación) |

---

## 3. Regla del Umbral del 90% y Reporte Semestral Final
- **Condición de habilitación (9 de 10):** El cierre/elaboración oficial del **Reporte Semestral Final** (`ReporteSemestralCoordinador`) se habilita cuando los tutores cumplan al menos el **90% de entregas (9 de 10)** en el periodo activo (`vw_metrics_final_report_readiness`).
- **Bloqueo en backend:** Si `< 90%`, `POST /api/metrics/final-report/finalize` responde `409 Conflict` (`code: "THRESHOLD_NOT_MET"`). La vista previa de borrador permanece disponible.
- **Consolidación:** Integra datos maestros de PostgreSQL 18 (`snake_case`), avance de cumplimiento, evaluaciones, índices de `Resultados-por-unidad FINAL.xls` y evidencias fotográficas aplicables.
- **Preservación de plantillas `.xlsx`:** Inyección de datos por `sheet_key` respetando hojas, celdas combinadas, estilos y fórmulas existentes (nunca sobrescribir celdas con fórmula salvo mapeo explícito).

---

## 4. Contrato Técnico (Backend .NET 10 / Frontend Vue 3 + TypeScript)
- **Base de datos (`snake_case`):** Tablas `tutoring_failure_reports`, `tutoring_unit_results_imports`, `tutoring_unit_result_rows`, `tutoring_coordinator_workbooks`, `tutoring_coordinator_workbook_tabs` y vista `vw_metrics_final_report_readiness`.
- **API (.NET 10):**
  - `GET /api/metrics/readiness?periodoId=` — Evaluador de umbral 90% (9/10).
  - `GET /api/metrics/failures` y `POST /api/metrics/failures` — Consulta paginada y captura de reprobación.
  - `POST /api/metrics/imports/unit-results` — Importación de `Resultados-por-unidad FINAL.xls` (`413`/`415`/`409`).
  - `GET /api/metrics/workbooks/{formatKey}` y `PUT /api/metrics/workbooks/{id}/tabs` — Guardado independiente por pestaña (`409` concurrencia).
  - `POST /api/metrics/final-report/finalize` — Cierre oficial protegido por umbral del 90%.
  - `GET /api/metrics/workbooks/{id}/preview` y `GET /api/metrics/workbooks/{id}/export` — Vista previa en navegador (PDF/XLSX) y descarga desde plantilla.
- **Frontend (Vue 3 + TypeScript):** Vistas diferenciadas por rol (`Admin` / `User`), filtros, tarjetas KPI, pestañas con guard de cambios sin guardar, barra de progreso hacia el 90%, vista previa en navegador, exportación con lock de reentrancia y compatibilidad con `withCredentials: true`.
