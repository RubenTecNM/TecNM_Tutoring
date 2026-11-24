# 02 — Vistas de Tutores (Módulo Compliance)

El dashboard [`ComplianceView.vue`](../../frontend/src/modules/compliance/views/ComplianceView.vue) despacha cada tarea en `openTaskForm()` a su vista dedicada según `task.formatKey`. Ninguno de los 7 formatos usa ya el modal genérico.

---

## 1. Catálogo de Vistas Individuales (5 Formatos)

### 1.1 `PlanTrabajo` — Plan de Trabajo de Tutorías
- **Vista:** [`PlanTrabajoView.vue`](../../frontend/src/modules/compliance/views/PlanTrabajoView.vue) · **Ruta:** `/compliance/plan-trabajo/:deliverableId`
- **Plantilla:** `FORMATO PLAN DE TRABAJO TUTORIAS ene-junio-26.docx`
- **Estructura:**
  - Encabezado pre-rellenado: periodo/semestre, grupo/semestre, carrera, turno (`Matutino`/`Vespertino`) y objetivo general del curso.
  - Tabla fija de **16 sesiones semanales** (`Sesión 1` a `Sesión 16`): rango de fechas, título, objetivo y actividades estratégicas.
  - Bloque explícito de **actividades mensuales normativas** + confirmación y notas.
  - Firma provisional del tutor (ver §3).

### 1.2 `DiagnosticoInicial` — Análisis del Diagnóstico Inicial
- **Vista:** [`DiagnosticoInicialView.vue`](../../frontend/src/modules/compliance/views/DiagnosticoInicialView.vue) · **Ruta:** `/compliance/diagnostico-inicial/:deliverableId`
- **Plantilla:** `DIAGNOSTICO-INICIAL TUTORIAS - FJ-26.xlsx` · **Hoja:** `informe_del_diagnostico`
- **Estructura:**
  - Encabezado institucional: Tutor, Fecha, Grupo, Turno, Período.
  - **4 preguntas estructuradas:**
    1. Total de alumnos recibidos (`>= 0`).
    2. Cantidad de desertores (`>= 0`) + descripción de motivos.
    3. Aprobados (`>= 0`) y reprobados (`>= 0`) con porcentajes en vivo.
    4. Características generales del grupo.
- **Validaciones:** enteros `>= 0`; desertores `<= total`; `aprobados + reprobados <= total`.

### 1.3 `Anexo14` — Seguimiento de la Trayectoria Académica
- **Vista:** [`Anexo14View.vue`](../../frontend/src/modules/compliance/views/Anexo14View.vue) · **Ruta:** `/compliance/anexo-14/:deliverableId`
- **Plantilla:** `Anexo 14.docx`
- **Estructura:**
  - Encabezado: Instituto, Carrera, Semestre, Mes, Tutor, Grupo, Aula, Evaluación parcial.
  - Matriz dinámica de estudiantes (`No. Control`, `Nombre`) × **6 asignaturas** (nombres editables) × **7 códigos de incidencia** (`1`–`7`, selección múltiple vía botones pill).
  - Conteo de sesiones individuales y grupales (`>= 0`), observaciones, fecha, firma del tutor y nombre de coordinador.

### 1.4 `Anexo15` — Registro para Desempeño Académico
- **Vista:** [`Anexo15View.vue`](../../frontend/src/modules/compliance/views/Anexo15View.vue) · **Ruta:** `/compliance/anexo-15/:deliverableId`
- **Plantilla:** `Anexo 15.docx`
- **Estructura:**
  - Encabezado: Semestre, Estudiante (`No. Control` + nombre).
  - Tabla de **7 asignaturas** × **8 temas (`I` a `VIII`)** + `Observaciones`.
  - Instrucciones oficiales y nota de apoyo con tutor o Coordinador de Tutorías.
- **Reglas de alerta:**
  - Calificación `0–100`; `< 70` resaltada en tinta/fondo rojo (`.failing`).
  - Más de 1 tema reprobado (`> 1`) en una asignatura activa fila en alerta (`.row-alert`) y badge `Foco de alerta`.
- **Correcciones aplicadas:**
  - Eliminado `TypeError` (`raw.trim is not a function`) cambiando `v-model` numérico por `:value` + `@input` + `toText()`.
  - Ocultados spinners nativos y ampliadas celdas `.col-topic` (`min-width: 84px`) y `.grade-input` (`min-width: 68px`) para 2–3 dígitos/decimales legibles.

### 1.5 `Anexo19AMensual` — Reporte Mensual del Tutor
- **Vista:** [`Anexo19AView.vue`](../../frontend/src/modules/compliance/views/Anexo19AView.vue) · **Ruta:** `/compliance/anexo-19a/:deliverableId`
- **Plantilla:** `Anexo 19-A.docx`
- **Estructura:**
  - Encabezado: Instituto, Nombre del Tutor, Fecha, Programa educativo, Grupo, Hora.
  - Tabla fija de **25 estudiantes** (`1`–`25`): Nombre, Tutoría Grupal, Tutoría Individual, Canalizados y Área canalizada (`Psicología`, `Trabajo Social`, `Enfermería`, `Tutorías`, `Académico`, `Desempeño`).
  - Fila de totales calculados en vivo, instructivo oficial, observaciones, fecha de entrega y firmas (Tutor, Coordinador, Jefe de Departamento).

---

## 2. Libros Multi-Pestaña con Persistencia Independiente (2 Formatos)

Ambos libros comparten encabezado pre-rellenado, guardan por pestaña (`tabKey`), muestran progreso de pestañas guardadas y bloquean pérdida de cambios (`isTabDirty` + `switchTab` + `onBeforeRouteLeave`).

### 2.1 `SeguimientoMensual` — 6 Pestañas
- **Vista:** [`SeguimientoMensualView.vue`](../../frontend/src/modules/compliance/views/SeguimientoMensualView.vue) · **Ruta:** `/compliance/seguimiento-mensual/:deliverableId`
- **Plantilla:** `Anexos Seguimiento de Tutorías-MENSUAL-FJ-26.xlsx`

| # | `tabKey` / `sheet_key` | Nombre exacto hoja Excel | Captura y reglas clave |
| :-: | :--- | :--- | :--- |
| 1 | `anexo_14_trayectoria_academica` | `'ANEXO 14 Trayectoria Academica'` | Incidencias 1–7 por alumno + notas y observaciones |
| 2 | `anexo_15_desempeno_acad` | `'ANEXO 15 desempeño acad '` *(espacio final)* | 7 asignaturas × temas I–VIII (`0–100`, `< 70` rojo, alerta `> 1` tema) |
| 3 | `seguimiento_ind_reprob` | `'SEGUIMIENTO IND. REPROB.'` | Inscritos, reprobados (`<= inscritos`), `%` en vivo (rojo `> 30%`), unidades y acción preventiva |
| 4 | `anexo_19a_mensual_tutor` | `'Anexo 19A Mensual del tutor'` | Atención grupal/individual, canalizados y área + observaciones |
| 5 | `seguimiento_individual` | `'SEGUIMIENTO INDIVIDUAL'` | Bitácora por alumno, fecha, motivo, acuerdos y flag canalizado |
| 6 | `lista_asistencia` | `'LISTA DE ASISTENCIA'` | 4 sesiones (`S1`–`S4`) con `%` asistencia calculado en vivo |

### 2.2 `SeguimientoFinal` — 4 Pestañas
- **Vista:** [`SeguimientoFinalView.vue`](../../frontend/src/modules/compliance/views/SeguimientoFinalView.vue) · **Ruta:** `/compliance/seguimiento-final/:deliverableId`
- **Plantilla:** `Anexos Seguimiento de Tutorías-FINAL- FJ-26.xlsx`

| # | `tabKey` / `sheet_key` | Nombre exacto hoja Excel | Captura y reglas clave |
| :-: | :--- | :--- | :--- |
| 1 | `anexo_19_reporte_semestral` | `'Anexo 19 Reporte Semestral'` | Estudiantes, atención grupal/individual, canalizados, área, totales, instructivo, observaciones y firmas |
| 2 | `informe_final_tutores` | `'informe final de tutores'` | 6 preguntas oficiales: actividades, deserción y motivos, total/aprobados/reprobados (validación suma `<= total`), tabla de causas por materia, metas y retroalimentación |
| 3 | `resultados_indice_reprob` | `'RESULTADOS DE INDICE DE REPROB.'` | Materia, docente, unidades `I–VIII` (`0–100%`, rojo `> 30%`), promedio por materia, `PROMEDIO FINAL DE REPROB.` y comentarios |
| 4 | `caracteristicas_gpo` | `'CARACTERISTICAS DEL GPO.'` | Descripción principal del grupo + fortalezas, áreas de oportunidad y recomendaciones |

---

## 3. Manejo Provisional de Firma del Tutor

Implementado de forma uniforme en `PlanTrabajo`, `Anexo14`, `Anexo19A`, `SeguimientoMensual` y `SeguimientoFinal`:

- **Modalidad por defecto (`name_confirmation`):** checkbox de confirmación vinculada al nombre autenticado del tutor (`header.tutorName`) que sella fecha/hora local (`tutorSignedAt`, formato `es-MX`). Requerida para entregar (`submit: true`).
- **Extensible sin cambios de contrato:**
  - `canvas`: lienzo HTML5 (`340×110`, eventos `pointer*`) que serializa a `signatureDataUrl` (`image/png` Base64).
  - `image`: carga de archivo de firma con validación estricta `PNG/JPG/WEBP` (`415`) y máximo `2 MB` (`413`).
- **Payload unificado:** `{ tutorName, confirmed, signedAt, mode, dataUrl }`.
