# Referrals (Canalizaciones) — Spec Frontend

> **SDD (Spec-Driven Development):** Contrato de interfaz, tipos, validaciones y flujos del módulo de Canalizaciones en Frontend, alineado a [`backend/Modules/Referrals/specs/referrals_database_spec.md`](../../../../../backend/Modules/Referrals/specs/referrals_database_spec.md) y [`AGENTS.md`](../../../../../AGENTS.md).

---

## 1. Dominio y Roles

| Rol | Alcance en la Interfaz |
| :--- | :--- |
| **Tutor (`User`)** | • Registra nuevas canalizaciones con validación estricta de matrícula (`1 letra + 8 dígitos`, ej. `I12345678`) y vista previa automática del alumno (Nombre completo, Carrera, Semestre, Matrícula).<br>• Si selecciona `Detectado por: Docente`, busca y selecciona al docente mediante autocompletado por nombre.<br>• Prevención de duplicados activos (misma matrícula + misma área en el periodo).<br>• Puede editar o cancelar (soft-delete) su reporte únicamente mientras siga en `Enviado` / `Sin leer`.<br>• Visualiza indicador `Con respuesta` cuando coordinación registra notas de seguimiento. |
| **Coordinadora / Admin (`Admin`)** | • Alerta flotante sobre **Canalizaciones** en el menú lateral con conteo global de reportes nuevos (`Sent` / `Unread`).<br>• Al abrir un reporte nuevo, se marca automáticamente como `Leído` (`Read`) y actualiza el badge al instante.<br>• Tarjetas KPI interactivas para filtrar con un clic.<br>• Búsqueda ampliada por matrícula, alumno, carrera y docente tutor.<br>• Listado ordenado de fecha más reciente a más antigua: primera columna muestra **Nombre completo** y debajo **Carrera · Matrícula**.<br>• Modal de atención muestra ficha completa del alumno (Nombre, Apellidos, Carrera, Semestre, Matrícula) + gestión de estatus y notas. |

---

## 2. Reglas de Validación y Catálogos

- **Formato de matrícula TecNM:** `^[A-Z]\d{8}$` (1 letra mayúscula seguida de 8 dígitos, ej. `I12345678`).
- **Estatus (`ReferralStatus`):** `Sent` (Enviado), `Received` (Recibido), `Read` (Leído), `Unread` (Sin leer), `Unattended` (Sin atender), `Attended` (Atendido).
- **Áreas (`SupportArea`):** `Psychology` (Psicología), `Nursing` (Enfermería), `Performance` (Desempeño), `Tutoring` (Tutorías), `SocialWork` (Trabajo Social), `Academic` (Académico).
