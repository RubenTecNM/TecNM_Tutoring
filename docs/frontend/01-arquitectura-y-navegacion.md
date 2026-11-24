# 01 — Arquitectura General, Navegación y Patrones UI

## 1. Estructura de Módulos (`frontend/src/`)

```text
frontend/src/
├── app/
│   ├── layouts/MainLayout.vue        ← Sidebar, tema, tarjeta usuario/rol y badge Referrals
│   └── router/index.ts               ← Guard auth (sessionCookie) + rutas hijas por módulo
├── shared/
│   ├── api/http.ts                   ← Instancia Axios con credenciales (cookies HttpOnly)
│   ├── api/apiErrors.ts              ← Normalizador único (409, 413, 415, 422)
│   └── components/                   ← UiBasePage, UiCard, UiTable, UiField, UiButton, UiDialog, UiBadge, UiAlert
└── modules/
    ├── auth/
    ├── compliance/                   ← 1 dashboard + 7 vistas dedicadas por formato
    ├── metrics/                      ← 1 dashboard + panel unidades I–VIII + 2 vistas Coordinación
    └── referrals/                    ← Gestión canalizaciones Tutor / Admin
```

---

## 2. Mapa Completo de Rutas SPA

Todas las rutas bajo `/` pasan por `MainLayout.vue` y requieren sesión activa (`meta.requiresAuth: true`).

| Ruta | Nombre | Vista (lazy-loaded) | Rol |
| :--- | :--- | :--- | :--- |
| `/login` | `login` | `LoginView.vue` | Público |
| `/session` | `session` | `SessionView.vue` | Autenticado |
| `/compliance` | `compliance-dashboard` | `ComplianceView.vue` | Tutor / Admin |
| `/compliance/plan-trabajo/:deliverableId` | `compliance-plan-trabajo` | `PlanTrabajoView.vue` | Tutor / Admin (lectura) |
| `/compliance/diagnostico-inicial/:deliverableId` | `compliance-diagnostico-inicial` | `DiagnosticoInicialView.vue` | Tutor / Admin (lectura) |
| `/compliance/anexo-14/:deliverableId` | `compliance-anexo-14` | `Anexo14View.vue` | Tutor / Admin (lectura) |
| `/compliance/anexo-15/:deliverableId` | `compliance-anexo-15` | `Anexo15View.vue` | Tutor / Admin (lectura) |
| `/compliance/anexo-19a/:deliverableId` | `compliance-anexo-19a` | `Anexo19AView.vue` | Tutor / Admin (lectura) |
| `/compliance/seguimiento-mensual/:deliverableId` | `compliance-seguimiento-mensual` | `SeguimientoMensualView.vue` | Tutor / Admin (lectura) |
| `/compliance/seguimiento-final/:deliverableId` | `compliance-seguimiento-final` | `SeguimientoFinalView.vue` | Tutor / Admin (lectura) |
| `/referrals` | `referrals` | `ReferralsView.vue` | Tutor / Admin |
| `/metrics` | `metrics-dashboard` | `MetricsView.vue` | Tutor / Admin |
| `/metrics/reporte-semestral/:periodoId?` | `metrics-reporte-semestral` | `ReporteSemestralCoordinadorView.vue` | Admin |
| `/metrics/matriz-control/:periodoId?` | `metrics-matriz-control` | `MatrizControlCoordinacionView.vue` | Admin |

---

## 3. Principio de Flujo: Formularios en Sistema (Sin Subida de Archivos)

- **Antes (flujo legado eliminado):** Compliance exigía subir archivos genéricos y Metrics dependía de cargar `.xls`.
- **Actual:**
  - Los 7 entregables del tutor y los 2 libros de coordinación se capturan **100% en formularios estructurados dedicados**, pre-rellenados desde BD (`prefilledData`).
  - El seguimiento de reprobación por unidad (unidades `I` a `VIII`) se captura y persiste directo en `MetricsView.vue` vía `UnitFailureTrackingPanel.vue` sin requerir carga de `.xls`.
  - La salida documental ocurre al revés: **sistema → plantilla oficial** (vista previa PDF/XLSX + exportación `.docx`/`.xlsx` respetando celdas combinadas, estilos y fórmulas).

---

## 4. Patrón de Vista Previa y Exportación

Todas las vistas dedicadas implementan:
1. **Botón `Vista previa`** → abre `UiDialog` con selector `PDF` / `XLSX` (`previewDeliverableTemplate` o `previewWorkbook`).
   - Si el backend devuelve URL/contenido renderizado (`previewUrlOrContent`), se incrusta en `<iframe>`.
   - Mientras backend no expone el renderizador, muestra el JSON estructurado exacto de la pestaña/formato (`<pre>`) para depuración del contrato.
2. **Botón `Exportar .docx` / `Exportar .xlsx`** → consume endpoint con `responseType: 'blob'` y dispara descarga con nombre institucional. Si backend devuelve `404`/`0`, informa claramente sin romper la UI.

---

## 5. Correcciones Técnicas Globales Aplicadas

| Problema detectado | Causa raíz | Solución aplicada en todas las vistas |
| :--- | :--- | :--- |
| Desaparición de tabla al editar números (detectado en `Anexo15View.vue`) | `v-model` en `<input type="number">` en Vue 3 convierte a `number`; helpers con `.trim()` lanzaban `TypeError` durante render | Uso de `:value` + `@input` + helper `toText(raw)` (`String(raw ?? '').trim()`). Ninguna tabla depende de `v-if` frágil al editar |
| Números cortados o tapados por flechas nativas en celdas compactas | Spinners nativos del navegador sobre celdas de 60–84px | `appearance: textfield; -moz-appearance: textfield;` + `::-webkit-inner-spin-button / ::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }` + `min-width: 64–68px` y `font-variant-numeric: tabular-nums` |
| Pérdida accidental de cambios en libros multi-pestaña | Cambio de pestaña o navegación sin aviso | Estado `isTabDirty`, confirmación al cambiar pestaña (`switchTab`) y `onBeforeRouteLeave` |
| Doble envío por clics repetidos | Reentrancia en botones de guardado/exportación | Guards booleanos (`isSaving`, `isPreviewing`, `isExporting`, `isFinalizing`) ligados a `:loading` y `:disabled` |
| Búsqueda sensible a acentos | Comparación directa `.toLowerCase()` | Normalización `NFD` (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`) en Referrals y Metrics |
