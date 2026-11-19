# Referrals (Canalizaciones) — Spec Frontend

> **SDD (Spec-Driven Development):** Contrato de interfaz, tipos, estados y flujos del módulo de Canalizaciones en Frontend, alineado a [`backend/Modules/Referrals/specs/referrals_database_spec.md`](../../../../../backend/Modules/Referrals/specs/referrals_database_spec.md) y [`AGENTS.md`](../../../../../AGENTS.md).

---

## 1. Dominio y Roles

| Rol | Alcance en la Interfaz |
| :--- | :--- |
| **Tutor (`User`)** | • Registra nuevas canalizaciones mediante modal.<br>• Visualiza únicamente sus canalizaciones enviadas a coordinación.<br>• Consulta el estado actual de cada reporte (`Enviado`, `Recibido`, `Leído`, `Sin leer`, `Atendido`, `Sin atender`) en modo lectura. |
| **Coordinadora / Admin (`Admin`)** | • Recibe alerta flotante (badge contador) sobre el botón **Canalizaciones** en navegación cuando existen reportes nuevos (`Sent` / `Unread`).<br>• Filtra por periodo, área, motivo, estado y búsqueda rápida.<br>• Visualiza listado priorizado de fecha más reciente a más antigua.<br>• Modifica/actualiza el estado de la canalización y registra notas de acción para dar seguimiento. |

---

## 2. Formulario de Nueva Canalización (Tutor)

Campos requeridos:
1. **Matrícula del alumno** (`matricula`, obligatorio).
2. **Carrera** (`studentCareer`, obligatorio).
3. **Detectado por** (`detectionSource`: `Tutor` | `Docente`):
   - Si es `Tutor`: no solicita nombre (es el usuario autenticado quien envía).
   - Si es `Docente`: solicita obligatoriamente **Nombre del docente** (`detectedByTeacherName`).
4. **Área a canalizar** (`supportArea`: Psicología, Enfermería, Desempeño, Tutorías, Trabajo Social, Académico).
5. **Motivo de canalización** (`referralReason`).
6. **Observaciones o situación detectada** (`observations`).

---

## 3. Tipos TypeScript (`src/modules/referrals/types/referrals.ts`)

```typescript
export type DetectionSource = 'Tutor' | 'Docente'

export type SupportArea =
  | 'Psychology'   // Psicología
  | 'Nursing'      // Enfermería
  | 'Performance'  // Desempeño
  | 'Tutoring'     // Tutorías
  | 'SocialWork'   // Trabajo Social
  | 'Academic'     // Académico

export type ReferralReason =
  | 'Academic'      // Académico
  | 'Emotional'     // Emocional
  | 'Personal'      // Personal
  | 'Discipline'    // Indisciplina
  | 'Health'        // Salud
  | 'Socioeconomic' // Socioeconómico

export type ReferralStatus =
  | 'Sent'        // Enviado
  | 'Received'    // Recibido
  | 'Read'        // Leído
  | 'Unread'      // Sin leer
  | 'Attended'    // Atendido
  | 'Unattended'  // Sin atender
```

---

## 4. Notificación Flotante en Navegación

- Composable `useReferralNotifications` mantiene el contador reactivo de reportes nuevos (`Sent` | `Unread`).
- `UiNavLink.vue` soporta `badge?: number` para mostrar una alerta flotante sobre el botón de **Canalizaciones** solo cuando el usuario autenticado es `Admin` y el contador es mayor a 0.
- Al actualizar el estado de un reporte desde la vista de Coordinación, el contador se sincroniza inmediatamente.
