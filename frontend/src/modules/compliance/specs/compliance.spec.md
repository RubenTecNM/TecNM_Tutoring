# Compliance — Spec Frontend

Contrato compartido de BD: [`docs/specs/especificaciones_de_base_de_datos.md`](../../../../../docs/specs/especificaciones_de_base_de_datos.md).  
Spec de BD del módulo: [`backend/Modules/Compliance/specs/compliance_database_spec.md`](../../../../../backend/Modules/Compliance/specs/compliance_database_spec.md).  
Este archivo añade responsabilidades exclusivas del frontend. No duplica contratos HTTP ni esquema de BD.

---

## 1. Dominio

Permite a docentes subir sus 7 entregables mensuales de tutoría y al Admin monitorear el cumplimiento de los 54 docentes con un semáforo de mora.

**Roles y alcance:**

| Rol JWT | Acceso |
| :--- | :--- |
| `Admin` | Visualiza tabla completa de los 54 docentes. Filtra por periodo, mes y tipo. No sube archivos. |
| `User` (Docente) | Ve solo sus propios entregables (`docente_clave` del JWT). Sube archivos. |

Filtrado por rol ocurre en el servicio backend mediante LINQ sobre claims JWT. Frontend nunca filtra ni infiere permisos.

---

## 2. Tipos TypeScript (ampliación de `types/compliance.ts`)

```ts
// Ya existente — ampliar sin romper
export type ReportType =
  | 'PlanTrabajo'
  | 'DiagnosticoInicial'
  | 'Anexo14'
  | 'Anexo15'
  | 'Anexo19AMensual'
  | 'Asistencia'
  | 'Anexo19Final';

export type DeliverableStatus = 'Pending' | 'OnTime' | 'Late';

export interface Deliverable {
  id: string;
  docenteClave: string;
  periodoId: number;
  reportType: ReportType;
  reportingMonth: number;      // 1-12
  status: DeliverableStatus;
  delayDays: number;
  fileId?: number;
}

// Para Admin: resumen por docente
export interface DocenteComplianceSummary {
  docenteClave: string;
  docenteName: string;         // resuelto en backend vía MainDbContext
  totalDeliverables: number;
  pending: number;
  onTime: number;
  late: number;
  totalDelayDays: number;      // suma de delay_days del docente
}

// Filtros activos en la vista
export interface ComplianceFilters {
  periodoId: number;
  month?: number;              // 1-12 | undefined = todos los meses
  reportType?: ReportType;
  status?: DeliverableStatus;
}

// Paginación (patrón docs/specs/pagination.spec.md)
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}
```

---

## 3. API (`api/complianceApi.ts`) — ampliar sin romper lo existente

```ts
// Endpoints a implementar (los que no existan aún)

// Admin: lista resumen de todos los docentes para el dashboard
getDocenteSummaries(filters: ComplianceFilters, page: number, limit: number)
  → GET /api/compliance/summary?periodoId=&page=&limit=&month=&status=
  → PaginatedResponse<DocenteComplianceSummary>

// Admin + User: detalle de entregables de UN docente
getDeliverables(docenteClave, periodoId, page, limit)
  → GET /api/compliance/{docenteClave}/{periodoId}?page=&limit=
  → PaginatedResponse<Deliverable>   ← ampliar tipo de retorno actual

// User: subir archivo
uploadDeliverable(deliverableId, file)
  → POST /api/compliance/{deliverableId}/upload   (multipart/form-data)
  → void   ← ya existe
```

Reglas:
- `withCredentials: true` vía `http` compartido.
- Bloquear reentrancia en upload: `if (isUploading.value) return`.
- En error `413 Payload Too Large`: mostrar "El archivo excede el tamaño permitido."
- En error `415 Unsupported Media Type`: mostrar "Solo se aceptan archivos PDF, DOC o DOCX."
- En error `409 Conflict` (ya entregado y en tiempo): mostrar mensaje del backend.

---

## 4. Vistas

### 4.1 `ComplianceView.vue` — vista principal (única vista del módulo)

**Ruta:** `/compliance`  
**Requiere auth:** sí  
**Componente raíz:** `UiBasePage fluid`

**Comportamiento por rol:**

#### Vista Admin
```
UiBasePage (fluid, title="Cumplimiento Docente")
  └─ UiPageHeader
       slot actions → UiButton "Exportar" (secondary)
  └─ Barra de filtros (periodo, mes, tipo, estado)
  └─ KPIs resumen (4 UiMetric)
       - Total docentes · Entregados en tiempo · Con retraso · Pendientes
  └─ UiTable → DocenteComplianceSummary[]
       Columnas: Docente | Entregados | En tiempo | Con retraso | Días mora | Acción
       Fila clic → navega a detalle del docente (/compliance/:docenteClave)
  └─ Paginación (Anterior / Siguiente / página actual)
```

#### Vista User (Docente)
```
UiBasePage (fluid, title="Mis Entregables de Tutoría")
  └─ Selector de periodo (mes actual por defecto)
  └─ UiTable → Deliverable[] del docente autenticado
       Columnas: Tipo | Mes | Estado | Días mora | Archivo | Acción
       Fila con status=Pending → botón "Subir" activo
       Fila con status=OnTime/Late → muestra badge + enlace a archivo (si file_id)
  └─ Paginación
```

### 4.2 `ComplianceDetailView.vue` — detalle de un docente (solo Admin)

**Ruta:** `/compliance/:docenteClave`  
**Requiere auth:** sí · rol: `Admin`  
**Componente raíz:** `UiBasePage fluid`

```
UiBasePage (title="Entregables — {nombreDocente}")
  └─ UiPageHeader slot actions → UiButton "← Volver"
  └─ Selector de periodo y mes
  └─ UiTable → Deliverable[] del docente
       Columnas: Tipo | Mes | Estado | Días mora | Archivo
  └─ Paginación
```

---

## 5. Componentes locales (`components/`)

### `DeliverableStatusBadge.vue`
Props: `status: DeliverableStatus`  
Renderiza `UiChip` / `UiBadge` con color semántico del sistema de diseño TecNM:

| Status | Variante | Texto |
| :--- | :--- | :--- |
| `Pending` | warning | Pendiente |
| `OnTime` | success | En tiempo |
| `Late` | danger | Con retraso |

### `DeliverableUploadButton.vue`
Props: `deliverableId: string`, `disabled: boolean`  
- Renderiza `UiButton variant="primary"` con `loading` durante upload.
- Acepta solo `.pdf`, `.doc`, `.docx` vía `accept`.
- Emite `uploaded` al completar · `error` con mensaje en caso de fallo.
- Guard de reentrancia interno: `if (isUploading.value) return`.

### `ComplianceFiltersBar.vue`
Props: `modelValue: ComplianceFilters`, lista de periodos disponibles.  
Emite `update:modelValue` al cambiar cualquier filtro.  
Componentes internos: `UiField as="select"` para periodo, mes, tipo y estado.

### `ComplianceSummaryKpis.vue`
Props: `summaries: DocenteComplianceSummary[]`  
Renderiza 4 `UiMetric`: total, en tiempo, con retraso, pendientes.  
Calcula totales desde la prop — sin llamada HTTP adicional.

---

## 6. Composables (`composables/`)

### `useComplianceAdmin.ts`
Estado: `summaries`, `loading`, `error`, `filters`, `pagination`.  
Métodos: `fetchSummaries()`, `updateFilters(partial)`, `goToPage(n)`.  
Guard de reentrancia: `if (loading.value) return`.

### `useComplianceDocente.ts`
Estado: `deliverables`, `loading`, `error`, `selectedPeriodo`, `pagination`.  
Métodos: `fetchDeliverables()`, `uploadFile(deliverableId, file)`.  
Después de upload exitoso: `fetchDeliverables()` para refrescar tabla.

---

## 7. Rutas (`routes.ts`) — reemplazar contenido actual

```ts
import type { RouteRecordRaw } from 'vue-router';

export const complianceRoutes: RouteRecordRaw[] = [
  {
    path: '/compliance',
    name: 'compliance',
    component: () => import('./views/ComplianceView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/compliance/:docenteClave',
    name: 'compliance-detail',
    component: () => import('./views/ComplianceDetailView.vue'),
    meta: { requiresAuth: true, roles: ['Admin'] },
  },
];
```

Ambas vistas usan lazy loading.  
Guard de roles en `meta.roles` — el router raíz ya maneja redirección `403`.

---

## 8. Barrel export (`index.ts`)

```ts
export { complianceRoutes } from './routes';
export type { Deliverable, DocenteComplianceSummary, ComplianceFilters } from './types/compliance';
```

Solo exportar lo que consuman otros módulos o el router raíz.

---

## 9. Integración con MainLayout

Agregar a `sidebarNavigation` en `mainLayout.config.ts`:

```ts
{ label: 'Cumplimiento', to: { name: 'compliance' } }
```

Agregar `complianceRoutes` a `children` de la ruta padre protegida en `app/router/index.ts`.

---

## 10. UI / Diseño (tokens de `DESIGN.md`)

- Raíz de contenido: `UiBasePage fluid`.
- Encabezado de módulo: `UiPageHeader` con `title` y slot `actions`.
- Tablas: `UiTable` con hover row en `--color-primary-subtle`.
- Badges de estado: `DeliverableStatusBadge` usando tokens semánticos success/warning/danger.
- KPIs: `UiMetric` con borde superior dorado (`--color-accent`) para "Con retraso".
- Formularios de filtro: `UiField as="select"` con tokens de borde y foco del sistema.
- Botón de subida: `UiButton variant="primary"` · mínimo 44 px · foco visible 2 px.
- Responsive: funcional desde 375 px. Tabla con scroll horizontal en móvil.
- Temas: claro y oscuro soportados vía tokens CSS globales. No hardcodear colores.

---

## 11. Accesibilidad

- `UiTable` con encabezados `<th scope="col">` en español.
- Estados de carga con `aria-busy="true"` en la región de tabla.
- Errores y confirmaciones de upload en región `aria-live="polite"`.
- Controles de paginación como `<nav aria-label="Paginación">`.
- `DeliverableUploadButton` describe el tipo de entregable en `aria-label`.

---

## 12. Criterios de aceptación

1. Admin carga `/compliance` y ve resumen de los 54 docentes con KPIs correctos.
2. Admin filtra por periodo, mes, tipo y estado; tabla se actualiza sin recargar página.
3. Admin navega a detalle de un docente y ve sus 7 entregables del periodo.
4. User (Docente) carga `/compliance` y ve solo sus propios entregables.
5. User sube archivo PDF/DOC/DOCX; fila cambia estado a `OnTime` o `Late` según fecha.
6. User intenta subir tipo MIME no permitido; recibe mensaje de error claro en es-MX.
7. Doble clic en "Subir" no genera dos peticiones (guard reentrancia activo).
8. Paginación funciona: cambiar página actualiza tabla sin recargar.
9. Semáforo de mora (badge) refleja `status` exacto devuelto por backend.
10. Vista es responsive desde 375 px; tabla tiene scroll horizontal en móvil.
11. Ambos temas (claro/oscuro) funcionan sin colores hardcodeados.
12. Backend conserva autoridad: frontend no filtra por rol desde JWT.
