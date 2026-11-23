# Compliance — Spec Frontend

Contrato compartido de BD: [`docs/specs/especificaciones_de_base_de_datos.md`](../../../../../docs/specs/especificaciones_de_base_de_datos.md).
Spec de BD del módulo: [`backend/Modules/Compliance/specs/compliance_database_spec.md`](../../../../../backend/Modules/Compliance/specs/compliance_database_spec.md).
Spec de Métricas y Cierre: [`frontend/src/modules/metrics/specs/metrics.spec.md`](../../metrics/specs/metrics.spec.md).
Este archivo añade responsabilidades exclusivas del frontend. No duplica contratos HTTP ni esquema de BD.

---

## 1. Dominio y Reglas de Captura

Migra el flujo del tutor de subida de archivos arbitrarios a **tareas/formularios estructurados pre-rellenados** desde PostgreSQL 18 (`snake_case`), manteniendo el monitoreo de cumplimiento de los 54 docentes y el semáforo de mora para `Admin`[cite: 3, 4, 5, 6].

**Reglas de negocio de captura y exportación:**
- **Sin subida de archivos como flujo principal:** El tutor no sube archivos arbitrarios. El sistema pre-rellena datos existentes en BD (alumnos, matrículas, números de lista, carrera, semestre, grupo, turno, tutor) y el docente completa únicamente campos faltantes (checklists, calificaciones/incidencias, observaciones y datos requeridos).
- **Evidencias fotográficas condicionales:** Solo se habilitan/solicitan evidencias fotográficas en los formatos o actividades que lo requieran; no se exigen cuando no aplican.
- **Tiempos de entrega parametrizables:** Las fechas o ventanas de entrega quedan configurables para agregarse después sin bloquear la captura, guardado, vista previa ni exportación.
- **Vista previa y exportación desde plantilla:** Al exportar un anexo/formato, los datos persistidos en BD se inyectan en la plantilla oficial correspondiente (respetando hojas y celdas en `.xlsx`) y se ofrece vista previa en el navegador (PDF o visor `.xlsx`) antes o al descargar.
- **Cierre / Reporte Semestral Final:** Se consolida dentro del módulo `metrics` al alcanzar el umbral del 90% (9 de 10 entregas) para elaborar el reporte semestral final.

**Roles y alcance:**

| Rol JWT | Acceso |
| :--- | :--- |
| `Admin` | Visualiza tabla completa de los 54 docentes, filtra por periodo, mes, formato/pestaña y estado, consulta detalle de tareas/respuestas por docente, previsualiza y exporta desde plantilla. No llena tareas de tutor. |
| `User` (Docente) | Ve solo sus propias tareas/formatos asignados (`docente_clave` resuelto en backend). Completa formularios/tablas pre-rellenados, guarda/envía avances, adjunta evidencias fotográficas solo si el formato lo requiere y consulta vista previa/exportación propia según aplique. |

Filtrado por rol y autoridad de negocio ocurren en el backend (.NET 10). Frontend no infiere permisos ni calcula reglas críticas de estado.

---

## 2. Catálogo de Formatos / Tareas del Docente / Tutor (7 Archivos)

Los 7 archivos del Docente / Tutor se estructuran como **ventanas únicas** (sin múltiples hojas) o **vistas con pestañas** (libros `.xlsx` multi-hoja):

### Ventana única (5 formatos)
1. `PlanTrabajo` — **Plan de trabajo del tutor** (`FORMATO PLAN DE TRABAJO TUTORIAS ene-junio-26.docx`)[cite: 3].
2. `DiagnosticoInicial` — **Informe del Diagnóstico** (`DIAGNOSTICO-INICIAL TUTORIAS - FJ-26.xlsx`).
3. `Anexo14` — **Formato de Seguimiento de la Trayectoria Académica** (`Anexo 14.docx`)[cite: 5].
4. `Anexo15` — **Formato de Registro para Desempeño Académico** (`Anexo 15.docx`)[cite: 4].
5. `Anexo19AMensual` — **Reporte Mensual del Tutor** (`Anexo 19-A.docx`)[cite: 6].

### Vista con pestañas — Seguimiento Mensual (`Anexos Seguimiento de Tutorías-MENSUAL-FJ-26.xlsx`, 6 pestañas)
6. `SeguimientoMensual` — Pestañas:
   - `anexo_14_trayectoria_academica` (*ANEXO 14 Trayectoria Academica*)
   - `anexo_15_desempeno_acad` (*ANEXO 15 desempeño acad*)
   - `seguimiento_ind_reprob` (*SEGUIMIENTO IND. REPROB.*)
   - `anexo_19a_mensual_tutor` (*Anexo 19A Mensual del tutor*)
   - `seguimiento_individual` (*SEGUIMIENTO INDIVIDUAL*)
   - `lista_asistencia` (*LISTA DE ASISTENCIA*)

### Vista con pestañas — Seguimiento Final (`Anexos Seguimiento de Tutorías-FINAL- FJ-26.xlsx`, 4 pestañas)
7. `SeguimientoFinal` — Pestañas:
   - `anexo_19_reporte_semestral` (*Anexo 19 Reporte Semestral*)
   - `informe_final_tutores` (*informe final de tutores*)
   - `resultados_indice_reprob` (*RESULTADOS DE INDICE DE REPROB.*)
   - `caracteristicas_gpo` (*CARACTERISTICAS DEL GPO.*)

*(Nota: Los formatos de Coordinación —`REPORTE SEMESTRAL DEL COORNADOR  EDITABLE.xlsx` y `tutores a-d 2026.xlsx`— y el insumo `Resultados-por-unidad FINAL.xls` pertenecen al módulo `metrics`).*

---

## 3. Tipos TypeScript (`types/compliance.ts`)

```ts
export type FormatKey =
  | 'PlanTrabajo'
  | 'DiagnosticoInicial'
  | 'Anexo14'
  | 'Anexo15'
  | 'Anexo19AMensual'
  | 'SeguimientoMensual'
  | 'SeguimientoFinal';

export type DeliverableStatus = 'Pending' | 'OnTime' | 'Late';

export type PreviewFormat = 'pdf' | 'xlsx';

export interface FormatTabDefinition {
  tabKey: string;
  label: string;
  requiresPhotoEvidence?: boolean;
}

export interface PrefilledFieldValue {
  key: string;
  label: string;
  value: string | number | boolean | null;
}

export interface DeliverableTask {
  id: string;
  docenteClave: string;
  periodoId: number;
  formatKey: FormatKey;
  title: string;
  hasTabs: boolean;
  tabs?: FormatTabDefinition[];
  activeTabKey?: string;
  reportingMonth?: number; // 1-12 si aplica
  status: DeliverableStatus;
  delayDays: number;
  requiresPhotoEvidence: boolean;
  photoEvidenceUrls?: string[];
  prefilledData: Record<string, unknown>;
  formPayload: Record<string, unknown>;
  updatedAt?: string;
}

export interface DocenteComplianceSummary {
  docenteClave: string;
  docenteName: string;
  totalDeliverables: number;
  pending: number;
  onTime: number;
  late: number;
  totalDelayDays: number;
}

export interface ComplianceFilters {
  periodoId: number;
  month?: number;
  formatKey?: FormatKey;
  status?: DeliverableStatus;
  search?: string;
}

export interface TemplatePreviewResult {
  deliverableId: string;
  tabKey?: string;
  previewFormat: PreviewFormat;
  previewUrlOrContent: string;
  fileName: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}
```

---

## 4. Guardas de Integridad, Pestañas y Manejo de Errores HTTP

- **Persistencia por pestaña:** Los libros multi-hoja (`SeguimientoMensual` y `SeguimientoFinal`) guardan su contenido por `tabKey` de forma independiente, advirtiendo antes de descartar cambios no guardados al cambiar de pestaña o cerrar el formulario.
- **Reentrancia:** Botones de guardado, vista previa y exportación bloquean ejecuciones concurrentes (`isSaving`, `isPreviewing`, `isExporting`).
- **Errores HTTP manejados en UI:** `409 Conflict` (concurrencia optimista/duplicado), `413 Payload Too Large` (evidencia fotográfica > 5 MB), `415 Unsupported Media Type` (MIME distinto a `image/jpeg`, `image/png`, `image/webp`) y `422 Unprocessable Entity` (campos obligatorios faltantes o rangos numéricos inválidos al exportar).
- **Pre-validación de exportación:** Advierte o bloquea la descarga si faltan campos obligatorios en la captura del formato o pestaña.
