# 04 — Contratos API, Payloads, Errores y Verificación (Guía Backend)

Referencia directa de lo que el frontend consume hoy en `complianceApi.ts`, `metricsApi.ts` y `referralsApi.ts` para alinear controladores y servicios en **.NET 10**.

---

## 1. Endpoints Esperados por Módulo

### 1.1 Auth (`authApi.ts`)
- `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` (cookie `HttpOnly`, retorna `{ username, name, role, email }`).

### 1.2 Compliance (`complianceApi.ts`)

| Método | Ruta | Query / Body | Respuesta |
| :--- | :--- | :--- | :--- |
| `GET` | `/compliance/{docenteClave}/{periodoId}` | `page, limit, month?, formatKey?, status?` | `PaginatedResponse<DeliverableTask>` |
| `GET` | `/compliance/summary` | `periodoId, month?, formatKey?, status?, search?, page, limit` | `PaginatedResponse<DocenteComplianceSummary>` |
| `GET` | `/compliance/tasks/{deliverableId}` | `tabKey?` | `DeliverableTask` (incluye `prefilledData` y `formPayload`) |
| `PUT` | `/compliance/tasks/{deliverableId}/form` | `{ tabKey?, formPayload, submit }` | `DeliverableTask` actualizado |
| `POST` | `/compliance/tasks/{deliverableId}/form` | `multipart/form-data` (`formPayload` JSON, `tabKey?`, `submit`, `photoEvidenceFiles[]`) | `DeliverableTask` actualizado |
| `GET` | `/compliance/tasks/{deliverableId}/preview` | `tabKey?, format=pdf\|xlsx` | `TemplatePreviewResult` |
| `GET` | `/compliance/tasks/{deliverableId}/export` | `tabKey?` (`responseType: 'blob'`) | Binario `.docx` / `.xlsx` |

**Notas de contrato `DeliverableTask`:**
- `formatKey`: `'PlanTrabajo' | 'DiagnosticoInicial' | 'Anexo14' | 'Anexo15' | 'Anexo19AMensual' | 'SeguimientoMensual' | 'SeguimientoFinal'`.
- Libros multi-pestaña (`hasTabs: true`) guardan cada hoja en `formPayload.tabs[tabKey]`, incluyendo `sheetKey`, `excelSheetName`, `header` y (cuando aplica) `signature`.
- En `prefilledData`, el frontend lee llaves `snake_case`: `docente_clave`, `docente_nombre`, `periodo_id`, `plantel`, `carrera`, `semestre`, `grupo`, `turno`.

### 1.3 Metrics (`metricsApi.ts`)

| Método | Ruta | Query / Body | Respuesta |
| :--- | :--- | :--- | :--- |
| `GET` | `/metrics/readiness` | `periodoId` | `FinalReportReadiness` (`compliancePercentage`, `requiredThresholdPercentage: 90`, `canGenerateFinalReport`) |
| `GET` | `/metrics/failures` | `periodoId, month?, riskLevel?, search?, page, limit` | `PaginatedResponse<FailureReportItem>` |
| `POST` | `/metrics/failures` | `CreateFailureReportRequest` | `FailureReportItem` |
| `GET` | `/metrics/unit-failure-tracking` | `periodoId` | `UnitFailureTrackingPayload` (`{ periodoId, rows[], comments, updatedAt? }`) |
| `PUT` | `/metrics/unit-failure-tracking` | `UnitFailureTrackingPayload` | `UnitFailureTrackingPayload` |
| `GET` | `/metrics/workbooks/{formatKey}` | `periodoId, tabKey?` | `CoordinatorWorkbook` (`tabs[]` con `rowVersion` por hoja) |
| `PUT` | `/metrics/workbooks/{workbookId}/tabs` | `{ tabKey, tabPayload, rowVersion, markCompleted? }` | `CoordinatorWorkbook` (incrementar `rowVersion`) |
| `POST` | `/metrics/final-report/finalize` | `{ periodoId }` | `CoordinatorWorkbook` (`status: 'Finalized'`) o `409 THRESHOLD_NOT_MET` |
| `GET` | `/metrics/workbooks/{workbookId}/preview` | `tabKey?, format=pdf\|xlsx` | `WorkbookPreviewResult` |
| `GET` | `/metrics/workbooks/{workbookId}/export` | `tabKey?` (`responseType: 'blob'`) | Binario `.xlsx` |
| `POST` | `/metrics/imports/unit-results` *(opcional/legado)* | `multipart/form-data` (`periodoId`, `file`) | `UnitResultsImportResponse` |

### 1.4 Referrals (`referralsApi.ts`)

| Método | Ruta | Uso |
| :--- | :--- | :--- |
| `GET` | `/students/{matricula}` | Lookup alumno (`^[A-Z]\d{8}$`) |
| `GET` | `/teachers?q=...` | Autocompletado de docentes |
| `GET` | `/referrals` | Listado filtrado (`periodoId`, `supportArea`, `referralReason`, `status`, `tutorClave`) |
| `POST` | `/referrals` | Crear canalización |
| `PUT` | `/referrals/{id}` | Editar (solo antes de ser leída/atendida) |
| `PATCH` | `/referrals/{id}/status` | Cambio de estatus y notas de coordinación |
| `DELETE` | `/referrals/{id}` | Soft-delete (`is_deleted = true`) |

---

## 2. Concurrencia Optimista (`rowVersion`)

- Cada libro de coordinación (`CoordinatorWorkbook`) y cada pestaña (`CoordinatorWorkbookTab`) transportan `rowVersion: number`.
- Al guardar una pestaña (`PUT /metrics/workbooks/{workbookId}/tabs`), el frontend envía el `rowVersion` vigente de esa pestaña.
- Si otro usuario modificó la pestaña, el backend debe responder **`409 Conflict`** con `{ code: 'CONFLICT', message: '...' }`. El frontend nunca oculta ese `409` tras fallback mock.

---

## 3. Manejo de Errores HTTP (`shared/api/apiErrors.ts`)

`normalizeApiError(error)` estandariza los códigos de negocio y los servicios API **relanzan sin caer en fallback local** cuando reciben cualquiera de estos 4 códigos:

| Código | `code` por defecto | Comportamiento frontend |
| :---: | :--- | :--- |
| `409` | `CONFLICT` / `THRESHOLD_NOT_MET` | Muestra alerta de conflicto de concurrencia, duplicado o umbral `< 90%` |
| `413` | `PAYLOAD_TOO_LARGE` | Informa exceso de tamaño permitido (firmas `2 MB`, fotos `5 MB`, Excel `10 MB`) |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Informa extensión/MIME no permitido |
| `422` | `VALIDATION_ERROR` | Muestra mensaje de validación y `fieldErrors[]` |

> **Política de fallback local (solo desarrollo):** cuando el endpoint backend aún no existe (`404` / error de red `0`), `complianceApi`, `metricsApi` y `referralsApi` persisten en `localStorage` (`tecnm_compliance_tasks_v3`, `tecnm_metrics_*`, `tecnm_referrals_mock_v5`) para permitir validación visual completa. En cuanto el endpoint backend responda `2xx` o `409/413/415/422`, opera directo contra PostgreSQL sin cambios en frontend.

---

## 4. Claves Exactas de Hojas Excel para el Motor de Exportación Backend

Respetar literalmente (incluidos espacios finales) al abrir con ClosedXML / EPPlus / OpenXML:

| Formato | `tabKey` | Nombre exacto de hoja en `.xlsx` |
| :--- | :--- | :--- |
| `DiagnosticoInicial` | `informe_del_diagnostico` | `'informe del diagnóstico'` |
| `SeguimientoMensual` | `anexo_14_trayectoria_academica` | `'ANEXO 14 Trayectoria Academica'` |
| `SeguimientoMensual` | `anexo_15_desempeno_acad` | `'ANEXO 15 desempeño acad '` *(espacio al final)* |
| `SeguimientoMensual` | `seguimiento_ind_reprob` | `'SEGUIMIENTO IND. REPROB.'` |
| `SeguimientoMensual` | `anexo_19a_mensual_tutor` | `'Anexo 19A Mensual del tutor'` |
| `SeguimientoMensual` | `seguimiento_individual` | `'SEGUIMIENTO INDIVIDUAL'` |
| `SeguimientoMensual` | `lista_asistencia` | `'LISTA DE ASISTENCIA'` |
| `SeguimientoFinal` | `anexo_19_reporte_semestral` | `'Anexo 19 Reporte Semestral'` |
| `SeguimientoFinal` | `informe_final_tutores` | `'informe final de tutores'` |
| `SeguimientoFinal` | `resultados_indice_reprob` | `'RESULTADOS DE INDICE DE REPROB.'` |
| `SeguimientoFinal` | `caracteristicas_gpo` | `'CARACTERISTICAS DEL GPO.'` |
| `ReporteSemestralCoordinador` | `hoja1` | `'Hoja1'` |
| `ReporteSemestralCoordinador` | `hoja2` | `'Hoja2'` |
| `MatrizControlCoordinacion` | `actividades` | `'actividades '` *(espacio al final)* |
| `MatrizControlCoordinacion` | `asesores` | `'asesores'` |
| `MatrizControlCoordinacion` | `primero_y_tercero` | `'1°Y 3°'` |
| `MatrizControlCoordinacion` | `quinto_y_septimo` | `'5° Y 7°'` |

---

## 5. Verificaciones Ejecutadas

- **Compilación y tipado estricto:** `npm --prefix frontend run build` (`vue-tsc --noEmit && vite build`) → **`0` errores** en todas las vistas y chunks lazy.
- **Despliegue en contenedor:** `docker-compose up -d --build --no-deps frontend` (puerto `6100 -> 80/tcp`, Nginx sirviendo `/dist`).
- **Pendientes backend para cierre integral:**
  1. Implementar endpoints `/compliance/*`, `/metrics/*` y `/referrals/*` según §1.
  2. Implementar inyección en plantillas `.docx` / `.xlsx` (`docs/formats/templates/`) respetando celdas combinadas, estilos y fórmulas de §4.
  3. Validar regla `>= 90%` server-side en `POST /metrics/final-report/finalize`.
