# Documentación Técnica Frontend — TecNM Campus Monclova (Tutorías)

> **Estado:** Implementado y compilando limpio (`vue-tsc --noEmit && vite build` → `0` errores).
> **Rama activa:** `Cano-FrontEnd` · **Stack:** Vue 3 · TypeScript · Vite 7 · Vue Router · Axios.

Guía técnica para el equipo frontend/backend y revisión de entregables del Sistema de Gestión de Tutorías.

---

## Índice

| Documento | Contenido | Audiencia principal |
| :--- | :--- | :--- |
| [01-arquitectura-y-navegacion.md](./01-arquitectura-y-navegacion.md) | Estructura modular, mapa de rutas, flujo sin subida de archivos, vista previa/exportación y correcciones UI/reactivas globales | Todo el equipo |
| [02-vistas-tutores-compliance.md](./02-vistas-tutores-compliance.md) | 7 vistas dedicadas de Cumplimiento (Tutores), mapeo exacto a plantillas `.docx`/`.xlsx`, pestañas, alertas y firma provisional | Frontend / Backend / QA |
| [03-vistas-coordinacion-metrics.md](./03-vistas-coordinacion-metrics.md) | Módulo de Métricas sin dependencia de carga de archivos, seguimiento por unidad (I–VIII), vistas dedicadas de Coordinación y umbral 90% | Frontend / Backend / Coordinación |
| [04-contratos-api-y-backend.md](./04-contratos-api-y-backend.md) | Endpoints HTTP, payloads JSON por módulo/pestaña, `rowVersion`, manejo de errores (`409`/`413`/`415`/`422`), fallback local y verificación | **Equipo Backend (.NET 10)** |

---

## Resumen de Módulos Implementados

| Módulo | Ruta base | Vistas / Componentes clave | Estado |
| :--- | :--- | :--- | :--- |
| `auth` | `/login` · `/session` | `LoginView`, `SessionView` (cookie `HttpOnly` + tarjeta usuario activo en `MainLayout`) | ✅ Activo |
| `compliance` | `/compliance` | `ComplianceView` + **7 vistas dedicadas** (5 individuales + 2 libros multi-pestaña) | ✅ Activo |
| `metrics` | `/metrics` | `MetricsView` + `UnitFailureTrackingPanel` + **2 vistas dedicadas de Coordinación** | ✅ Activo |
| `referrals` | `/referrals` | `ReferralsView` + `CreateReferralModal` + badge global en `MainLayout` | ✅ Activo |

---

## Plantillas Oficiales Cubiertas (`docs/formats/templates/`)

| Plantilla oficial | Clave sistema | Vista dedicada | Hojas / Pestañas |
| :--- | :--- | :--- | :--- |
| `FORMATO PLAN DE TRABAJO TUTORIAS ene-junio-26.docx` | `PlanTrabajo` | `PlanTrabajoView.vue` | 16 sesiones + bloque mensual |
| `DIAGNOSTICO-INICIAL TUTORIAS - FJ-26.xlsx` | `DiagnosticoInicial` | `DiagnosticoInicialView.vue` | `informe del diagnóstico` |
| `Anexo 14.docx` | `Anexo14` | `Anexo14View.vue` | Matriz 6 asignaturas × 7 incidencias |
| `Anexo 15.docx` | `Anexo15` | `Anexo15View.vue` | 7 asignaturas × temas I–VIII |
| `Anexo 19-A.docx` | `Anexo19AMensual` | `Anexo19AView.vue` | 25 estudiantes + totales |
| `Anexos Seguimiento de Tutorías-MENSUAL-FJ-26.xlsx` | `SeguimientoMensual` | `SeguimientoMensualView.vue` | 6 pestañas independientes |
| `Anexos Seguimiento de Tutorías-FINAL- FJ-26.xlsx` | `SeguimientoFinal` | `SeguimientoFinalView.vue` | 4 pestañas independientes |
| `REPORTE SEMESTRAL DEL COORNADOR  EDITABLE.xlsx` | `ReporteSemestralCoordinador` | `ReporteSemestralCoordinadorView.vue` | 2 pestañas + regla 90% |
| `tutores a-d 2026.xlsx` | `MatrizControlCoordinacion` | `MatrizControlCoordinacionView.vue` | 4 pestañas independientes |
| `Resultados-por-unidad FINAL.xls` (modelo de seguimiento) | `UnitFailureTracking` | `UnitFailureTrackingPanel.vue` | Captura directa en sistema (sin subir archivo) |

---

## Usuarios Demo Activos (Dev / Docker)

Definidos en [`docs/database/01_users.sql`](../database/01_users.sql) (contraseña local: `TecNM-Demo-2026!`):

| Usuario | Rol JWT | Clave docente mapeada | Vistas principales |
| :--- | :--- | :--- | :--- |
| `admin` | `Admin` | — | Resumen Compliance, Referrals (gestión/atención), Métricas, Reporte Semestral y Matriz de Control |
| `usuario` | `User` | `D0001` | 7 formatos Compliance propios, Canalizaciones propias, Métricas/Reprobación |
| `usuario2` | `User` | `D0002` | Aislamiento estricto por tutor (`D0002`) |
