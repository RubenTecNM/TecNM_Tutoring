# AGENTS.md — TecNM Campus Monclova: Sistema de Tutorías

> **Punto de entrada obligatorio.** Todo agente IA debe leer este archivo antes de cualquier acción.
> Redactado bajo skill **caveman**: máxima concisión, cero redundancia.

---

## 1. Sistema

**Producto:** Sistema de Gestión de Tutorías — TecNM Campus Monclova.
**Propósito:** Digitalizar y centralizar tres procesos institucionales de tutoría:
1. **Compliance** — Seguimiento de los 7 anexos/formatos obligatorios de 54 docentes por mes.
2. **Referrals** — Canalizaciones de alumnos a Psicología, Trabajo Social, Enfermería y Tutorías.
3. **Metrics** — Alertas de reprobación por materia/grupo con niveles de riesgo.

**Estado actual:** Fase de implementación. Auth local funcional (backend + frontend). Módulos de dominio en diseño de specs.

---

## 2. Stack Técnico

| Capa | Tecnología |
| :--- | :--- |
| **Backend** | .NET 10 · ASP.NET Core Web API · EF Core 10 |
| **Base de Datos** | PostgreSQL (Npgsql EF Provider) |
| **Frontend** | Vue 3 · TypeScript · Vite · Vue Router · Axios |
| **Auth** | JWT HMAC-SHA256 en cookies `HttpOnly` |
| **Contenedores** | Docker / Docker Compose |

---

## 3. Convenciones Globales (No Negociables)

| Dominio | Regla |
| :--- | :--- |
| **Código** | Inglés: clases, métodos, variables, DTOs, archivos, rutas API. |
| **UI / Respuestas** | es-MX: todo texto visible al usuario, mensajes de error y validaciones. |
| **PostgreSQL** | `snake_case`: tablas, columnas, índices, constraints, vistas. |
| **SQL en código** | Prohibido. LINQ async + EF Core. Consultas complejas → `CREATE VIEW` mapeada. |
| **Controllers** | Thin: solo transporte HTTP y códigos de estado. Lógica en services. |
| **DTOs** | Nunca exponer entidades EF por la API. |
| **Doble petición** | Todo endpoint mutativo es idempotente. Frontend bloquea reentrancia (`isSubmitting`). |
| **Soft Delete** | Nunca `DELETE` físico. `is_deleted = true` + campos `deleted_*`. |
| **Auditoría** | 10 campos obligatorios en todas las tablas de Tutorías (ver §8). |
| **Secretos** | `Jwt__SecretKey` y cadenas de conexión fuera de Git (user-secrets / env vars). |
| **SDD** | Spec antes que código. Nunca escribir C#/Vue sin spec vigente en `specs/`. |

---

## 4. Arquitectura: Bounded Context Dual

```text
BD Principal (Legacy, Read-Only)          BD Tutorías (Read/Write)
├── Alumnos (Matricula)                   ├── tutoring_deliverables
├── Docentes (Clave)                      ├── tutoring_referrals
├── Periodos (PeriodoID)                  └── tutoring_failure_reports
├── Asignaturas (ClaveMateria)
└── Files (ID)
```

- **Sin FK físicas** entre BDs. Solo llaves lógicas (`docente_clave`, `matricula`, etc.).
- **Application-Level Joins** en C# vía `MainDbContext` + `TutoringDbContext` paralelos.
- **Resolución DTO en servicios** antes de responder al frontend.

---

## 5. Mapa de Módulos Backend (`backend/Modules/`)

| Módulo | Tabla BD | Spec | Estado |
| :--- | :--- | :--- | :--- |
| `Auth` | `users` | [`Modules/Auth/specs/`](./backend/Modules/Auth/specs/) | ✅ Implementado |
| `Health` | — | [`Modules/Health/specs/`](./backend/Modules/Health/specs/) | ✅ Implementado |
| `Compliance` | `tutoring_deliverables` | [`Modules/Compliance/specs/`](./backend/Modules/Compliance/specs/) | 🔧 Spec lista, pendiente código |
| `Referrals` | `tutoring_referrals` | [`Modules/Referrals/specs/`](./backend/Modules/Referrals/specs/) | 🔧 Spec lista, pendiente código |
| `Metrics` | `tutoring_failure_reports` | [`Modules/Metrics/specs/`](./backend/Modules/Metrics/specs/) | 🔧 Spec lista, pendiente código |

**Patrón por módulo:**
```text
Modules/<Feature>/
├── specs/              ← SDD: leer ANTES de codificar
├── <Feature>Controller.cs
├── <Feature>Service.cs
└── <Feature>DTOs.cs
```

---

## 6. Mapa de Módulos Frontend (`frontend/src/modules/`)

| Módulo | Ruta SPA | Spec | Estado |
| :--- | :--- | :--- | :--- |
| `auth` | `/login` · `/` | [`src/modules/auth/specs/`](./frontend/src/modules/auth/specs/) | ✅ Implementado |
| `compliance` | `/compliance` | pendiente | 🕐 Sin spec |
| `referrals` | `/referrals` | pendiente | 🕐 Sin spec |
| `metrics` | `/metrics` | pendiente | 🕐 Sin spec |

**Patrón por módulo:**
```text
src/modules/<feature>/
├── specs/           ← SDD: leer ANTES de codificar
├── api/             ← llamadas HTTP del dominio
├── types/           ← interfaces y DTOs TypeScript
├── views/           ← páginas (lazy loaded)
├── components/      ← UI local del slice
├── composables/     ← hooks reactivos del slice
├── routes.ts        ← rutas + lazy loading
└── index.ts         ← barrel export (API pública)
```

---

## 7. Contratos y Documentación Raíz

| Documento | Ubicación | Propósito |
| :--- | :--- | :--- |
| Contrato Auth | [`specs/auth.spec.md`](./specs/auth.spec.md) | Fuente de verdad: endpoints, cookies, JWT, DTOs |
| Arquitectura Backend | [`docs/architecture/BACKEND_ARCHITECTURE.md`](./docs/architecture/BACKEND_ARCHITECTURE.md) | Estructura .NET, principios, patrones |
| Arquitectura Frontend | [`docs/architecture/FRONTEND_ARCHITECTURE.md`](./docs/architecture/FRONTEND_ARCHITECTURE.md) | Estructura Vue, módulos, shared |
| Estándar Auth | [`docs/architecture/AUTH.md`](./docs/architecture/AUTH.md) | Cookies, JWT, ciclo de vida, proveedores |
| Spec BD (Tutorías) | [`docs/specs/especificaciones_de_base_de_datos.md`](./docs/specs/especificaciones_de_base_de_datos.md) | ERD, tablas, auditoría, llaves lógicas |
| Plan Auth | [`docs/plans/01-auth-implementation.md`](./docs/plans/01-auth-implementation.md) | Fases 1-4 de implementación base |
| DB SQL | [`docs/database/database.sql`](./docs/database/database.sql) | Script inicial PostgreSQL |
| AGENTS Backend | [`backend/AGENTS.md`](./backend/AGENTS.md) | Contexto específico .NET para agentes |
| AGENTS Frontend | [`frontend/AGENTS.md`](./frontend/AGENTS.md) | Contexto específico Vue para agentes |

---

## 8. Estándar de Auditoría (10 Campos Obligatorios)

Todas las tablas de tutorías deben incluir:

```sql
created_at   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
created_by   varchar(254) NOT NULL,   -- email del JWT activo
created_ip   varchar(45)  NOT NULL,   -- IP del cliente
updated_at   timestamptz NULL,
updated_by   varchar(254) NULL,
updated_ip   varchar(45)  NULL,
is_deleted   boolean NOT NULL DEFAULT false,
deleted_at   timestamptz NULL,
deleted_by   varchar(254) NULL,
deleted_ip   varchar(45)  NULL
```

`updated_at` se actualiza vía trigger PostgreSQL. `created_by` y `created_ip` se inyectan desde `CurrentUserService` (HttpContext + JWT claims).

---

## 9. Skills Obligatorias para Agentes

Cargar antes de cualquier tarea en este repositorio:

| Skill | Propósito | Uso |
| :--- | :--- | :--- |
| `caveman` | Documentación ultra-concisa | **Obligatoria** para specs y docs |
| `ponytail` | Código mínimo, sin sobreingeniería | Backend y frontend |
| `frontend-design` | Dirección visual TecNM | Componentes y vistas |
| `ui-ux-pro-max` | UI/UX, accesibilidad, responsive | Diseño de interfaz |

**Comandos de registro:**
```bash
npx skills add https://github.com/juliusbrussee/caveman --skill caveman
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max
npx skills add https://github.com/dietrichgebert/ponytail --skill ponytail
```

> Si una skill no puede cargarse, informar al usuario y esperar confirmación antes de proceder.

---

## 10. Comandos de Desarrollo

### Backend
```bash
# Secretos locales (una vez)
dotnet user-secrets set --project backend/TecNM.Api.csproj "ConnectionStrings:DefaultConnection" "Host=127.0.0.1;Port=5432;Database=tecnm_tutoring;Username=tecnm_app;Password=<local>"
dotnet user-secrets set --project backend/TecNM.Api.csproj "Jwt:SecretKey" "<mínimo 32 bytes UTF-8>"

# Ciclo de trabajo
dotnet restore backend/TecNM.Api.csproj
dotnet build backend/TecNM.Api.csproj --no-restore
dotnet run --project backend/TecNM.Api.csproj
```

### Frontend
```bash
pnpm --prefix frontend install
pnpm --prefix frontend run dev -- --host
pnpm --prefix frontend run build
```

### Docker
```bash
docker compose up -d
```

### Smoke test (Auth)
```bash
bash scripts/smoke-auth.sh
```

---

## 11. Reglas SDD para Agentes

1. **Leer spec local** del módulo antes de generar código.
2. **Actualizar spec** si el contrato cambia, antes que el código.
3. **Cambiar `specs/auth.spec.md`** primero cuando cambie API, cookie, DTO o error compartido.
4. **Registrar módulo nuevo** en este `AGENTS.md` y en el `AGENTS.md` del proyecto correspondiente (backend o frontend).
5. **No crear carpetas vacías.** Solo cuando exista código que alojar.
6. **Paquetes directos solo.** No agregar dependencias sin uso real en el sprint activo.

---

## 12. Roles del Sistema

| Rol JWT | Acceso |
| :--- | :--- |
| `Admin` | Acceso total. Dashboard, reportes, gestión de usuarios. |
| `User` (Docente/Tutor) | Solo sus propios registros. Compliance y canalizaciones propias. |

Filtrado por rol implementado en servicios via LINQ inyectado desde claims JWT. Nunca filtrar en frontend.
