# 03 — Módulo de Métricas y Vistas de Coordinación

El módulo [`frontend/src/modules/metrics/`](../../frontend/src/modules/metrics/) concentra el seguimiento de reprobación, alertas tempranas, umbral de cierre del 90% y los 2 libros oficiales de Coordinación.

---

## 1. Dashboard Principal (`MetricsView.vue`)

- **Ruta:** `/metrics` (`metrics-dashboard`)
- **Flujo sin subida de archivos:** se eliminó el botón `Cargar Resultados (.xls)` y el modal de subida en `MetricsView.vue`. Todo se gestiona desde vistas y datos del sistema.
- **Bloques en pantalla:**
  1. **Umbral del 90% (`ReadinessThresholdBanner.vue`):** muestra `completedDeliveries / totalExpectedDeliveries`, barra de progreso y estado del cierre oficial (requiere `>= 90%`, ej. 9 de 10 entregas).
  2. **Libros Oficiales de Coordinación (solo `Admin`):** accesos directos a las 2 vistas dedicadas (`ReporteSemestralCoordinadorView` y `MatrizControlCoordinacionView`). Ninguno usa ya el panel genérico.
  3. **Seguimiento de Índices de Reprobación en Examen (`UnitFailureTrackingPanel.vue`):** captura/consulta directa por periodo de `Materia`, `Docente`, unidades `I–VIII` (`0–100%`, alerta visual `> 30%`), promedio por fila, `PROMEDIO FINAL DE REPROB.` y comentarios.
  4. **Filtros + KPIs + Tabla Paginada de Alertas:** filtros por periodo, mes, nivel de riesgo (`Low`, `Medium`, `High`, `Critical`) y búsqueda normalizada sin acentos (`NFD`). Modal de captura manual para Tutores con validación de mes (`1–12`), `failed <= total` e inputs sin spinners.

---

## 2. `ReporteSemestralCoordinador` (2 Pestañas + Regla 90%)

- **Vista:** [`ReporteSemestralCoordinadorView.vue`](../../frontend/src/modules/metrics/views/ReporteSemestralCoordinadorView.vue)
- **Ruta:** `/metrics/reporte-semestral/:periodoId?` (`metrics-reporte-semestral`)
- **Plantilla:** `REPORTE SEMESTRAL DEL COORNADOR  EDITABLE.xlsx`

### Pestañas mapeadas

| # | `tabKey` / `sheet_key` | Nombre exacto hoja Excel | Contenido |
| :-: | :--- | :--- | :--- |
| 1 | `hoja1` | `'Hoja1'` | Apoyos institucionales (`SP`, `SS`, `AD`, `BM`, `BT`, `BA`, `AA`, `APAA`, `AS` con modalidad Externa/Interna/Otras/Ninguno) + tabla por Programa Educativo/Semestre (tutores, capacitados, 6 modalidades de atención, bajas definitivas/temporales, talleres, 4 índices `0–100%`, canalizados por área y fila de totales) |
| 2 | `hoja2` | `'Hoja2'` | Seguimiento nominal por alumno (`Nombre`, `No. Control`, atendidos grupal/individual, bajas, índices `0–100%`, canalizados por área, fila `TOTAL` y nomenclatura oficial) |

### Regla del 90% y Cierre Oficial
- Integra `ReadinessThresholdBanner` conectado a `metricsApi.getReadiness(periodoId)`.
- Botón de cierre ejecuta `metricsApi.finalizeFinalReport(periodoId)`:
  - Bloqueado si `canGenerateFinalReport === false` (`< 90%`) o si existen cambios sin guardar (`isTabDirty === true`).
  - Al finalizar (`status === 'Finalized'`), toda la vista pasa a solo lectura (`isReadOnly = true`).

---

## 3. `MatrizControlCoordinacion` (4 Pestañas)

- **Vista:** [`MatrizControlCoordinacionView.vue`](../../frontend/src/modules/metrics/views/MatrizControlCoordinacionView.vue)
- **Ruta:** `/metrics/matriz-control/:periodoId?` (`metrics-matriz-control`)
- **Plantilla:** `tutores a-d 2026.xlsx`

### Pestañas mapeadas

| # | `tabKey` / `sheet_key` | Nombre exacto hoja Excel | Contenido y controles |
| :-: | :--- | :--- | :--- |
| 1 | `actividades` | `'actividades '` *(espacio final)* | Tutores, carrera, semestre, total alumnos (`>= 0`), checkboxes institucionales (Ánforas, Encuesta socioemocional, Pañales, Concluyó curso, Juguetes, Murales/Tapitas) y alumnos que concluyeron (`<= total`) |
| 2 | `asesores` | `'asesores'` | Docentes asesores, materias, carrera, horas (`>= 0`), checkboxes Plan de Trabajo y reportes Feb–Jun |
| 3 | `primero_y_tercero` | `'1°Y 3°'` | Matriz de entregas para 1° y 3°: turno (`Matutino`/`Nocturno`), alumnos (`>= 0`), selectores `— / √ / x` (Plan, Diagnóstico, Feb–May, Final, Eval. Tutor), `% R` (`0–100%`, rojo `> 30%`) y revisiones `1R–4R` |
| 4 | `quinto_y_septimo` | `'5° Y 7°'` | Misma matriz de control para semestres 5° y 7° |

---

## 4. Validaciones, Guard y Exportación (Ambas Vistas)

- **Pre-llenado:** encabezado compartido pre-rellenado desde `prefilledData` y usuario autenticado (`me()`).
- **Validaciones:**
  - Conteos y horas: enteros `>= 0`.
  - Porcentajes/índices (`% R`, reprobación, rezago, deserción, eficiencia terminal): `0–100%`.
  - Consistencia: `studentsCompleted <= totalStudents`.
- **Controles UI:** inputs numéricos sin flechas spinner (`appearance: textfield`), estado string-safe (`:value` + `@input`), sin ocultamiento de tablas.
- **Guard:** `isTabDirty` confirma descarte al cambiar pestaña (`switchTab`) y al salir (`onBeforeRouteLeave`).
- **Persistencia:** independiente por pestaña mediante `metricsApi.saveCoordinatorTab` enviando `rowVersion` y `markCompleted`.
- **Salida:** diálogo `Vista previa` (`PDF` / `XLSX`) y descarga `Exportar .xlsx`.
