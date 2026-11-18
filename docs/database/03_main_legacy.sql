-- =============================================================================
-- BD PRINCIPAL (espejo de desarrollo, SOLO LECTURA desde la API)
-- Motor: PostgreSQL 18 · Base: tecnm_main (separada de la BD de Tutorías)
-- Origen: estructura_tablas.sql / estructura_usuarios_alumnos.sql (SET_MX, SQL Server)
-- Reglas:
--   * snake_case. Sin FK desde/hacia la BD de Tutorías (solo llaves lógicas).
--   * Solo columnas útiles para Tutorías. Excluidos: contraseñas, CURP, RFC, NSS,
--     fotos y datos médicos.
--   * Producción: reemplazar por carga/ETL real; no usar los datos demo.
-- Idempotente: se puede re-ejecutar manualmente.
-- =============================================================================

SELECT 'CREATE DATABASE tecnm_main'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'tecnm_main')\gexec

\connect tecnm_main

BEGIN;

-- 1. Catálogos independientes
CREATE TABLE IF NOT EXISTS periodos (
    periodo_id    integer     NOT NULL,
    periodo       varchar(20) NOT NULL,
    nombre_corto  varchar(20) NOT NULL,
    CONSTRAINT pk_periodos PRIMARY KEY (periodo_id)
);

CREATE TABLE IF NOT EXISTS departamentos (
    cve_depto     integer     NOT NULL,
    departamento  varchar(70) NOT NULL,
    CONSTRAINT pk_departamentos PRIMARY KEY (cve_depto)
);

CREATE TABLE IF NOT EXISTS turnos (
    turno_id  integer     NOT NULL,
    turno     varchar(20) NOT NULL,
    CONSTRAINT pk_turnos PRIMARY KEY (turno_id)
);

CREATE TABLE IF NOT EXISTS estatus (
    estatus_id  varchar(3)  NOT NULL,
    estatus     varchar(40) NOT NULL,
    CONSTRAINT pk_estatus PRIMARY KEY (estatus_id)
);

CREATE TABLE IF NOT EXISTS carreras (
    carrera_id    integer     NOT NULL,
    carrera       varchar(90) NOT NULL,
    nombre_corto  varchar(50) NOT NULL,
    modalidad     varchar(20) NOT NULL,
    nivel         varchar(20) NOT NULL,
    vigente       boolean     NOT NULL DEFAULT true,
    CONSTRAINT pk_carreras PRIMARY KEY (carrera_id)
);

CREATE TABLE IF NOT EXISTS asignaturas (
    clave_materia  varchar(15)  NOT NULL,
    clave_oficial  varchar(15)  NOT NULL,
    asignatura     varchar(100) NOT NULL,
    nombre_corto   varchar(50)  NULL,
    creditos       integer      NOT NULL,
    CONSTRAINT pk_asignaturas PRIMARY KEY (clave_materia)
);

-- 2. Dependientes de carreras
CREATE TABLE IF NOT EXISTS plan_estudios (
    plan_est_id  integer     NOT NULL,
    carrera_id   integer     NOT NULL,
    plan_est     varchar(20) NOT NULL,
    modalidad    varchar(20) NOT NULL,
    vigente      boolean     NOT NULL DEFAULT true,
    CONSTRAINT pk_plan_estudios PRIMARY KEY (plan_est_id, carrera_id),
    CONSTRAINT fk_plan_estudios_carreras FOREIGN KEY (carrera_id) REFERENCES carreras (carrera_id)
);

CREATE TABLE IF NOT EXISTS especialidades (
    especialidad_id  integer      NOT NULL,
    carrera_id       integer      NOT NULL,
    especialidad     varchar(100) NOT NULL,
    vigente          boolean      NOT NULL DEFAULT false,
    CONSTRAINT pk_especialidades PRIMARY KEY (especialidad_id),
    CONSTRAINT fk_especialidades_carreras FOREIGN KEY (carrera_id) REFERENCES carreras (carrera_id)
);

-- 3. Docentes (tutores). Llave lógica desde users.docente_clave y tutoring_*.
CREATE TABLE IF NOT EXISTS docentes (
    clave         varchar(5)   NOT NULL,
    nombre        varchar(60)  NOT NULL,
    apellidos     varchar(60)  NOT NULL,
    sexo          varchar(1)   NOT NULL,
    correo        varchar(100) NOT NULL,
    tipo          varchar(20)  NULL,
    cve_depto     integer      NULL,
    total_horas   integer      NULL,
    vigente       boolean      NOT NULL DEFAULT true,
    CONSTRAINT pk_docentes PRIMARY KEY (clave),
    CONSTRAINT fk_docentes_departamentos FOREIGN KEY (cve_depto) REFERENCES departamentos (cve_depto)
);

-- 4. Alumnos. Llave lógica desde tutoring_referrals.matricula.
CREATE TABLE IF NOT EXISTS alumnos (
    matricula         varchar(12) NOT NULL,
    apellidos         varchar(50) NOT NULL,
    nombre            varchar(50) NOT NULL,
    sexo              varchar(1)  NOT NULL,
    semestre          integer     NOT NULL,
    carrera_id        integer     NOT NULL,
    modalidad         varchar(20) NOT NULL,
    plan_est_id       integer     NOT NULL,
    especialidad_id   integer     NULL,
    estatus_id        varchar(3)  NOT NULL,
    generacion        varchar(4)  NOT NULL,
    inscrito          boolean     NOT NULL DEFAULT false,
    turno_id          integer     NULL,
    periodo_ingreso   integer     NOT NULL,
    correo            varchar(50) NULL,
    seccion           varchar(2)  NULL,
    CONSTRAINT pk_alumnos PRIMARY KEY (matricula),
    CONSTRAINT fk_alumnos_carreras FOREIGN KEY (carrera_id) REFERENCES carreras (carrera_id),
    CONSTRAINT fk_alumnos_plan_estudios FOREIGN KEY (plan_est_id, carrera_id) REFERENCES plan_estudios (plan_est_id, carrera_id),
    CONSTRAINT fk_alumnos_especialidades FOREIGN KEY (especialidad_id) REFERENCES especialidades (especialidad_id),
    CONSTRAINT fk_alumnos_estatus FOREIGN KEY (estatus_id) REFERENCES estatus (estatus_id),
    CONSTRAINT fk_alumnos_turnos FOREIGN KEY (turno_id) REFERENCES turnos (turno_id),
    CONSTRAINT fk_alumnos_periodos FOREIGN KEY (periodo_ingreso) REFERENCES periodos (periodo_id)
);

CREATE INDEX IF NOT EXISTS idx_alumnos_carrera_semestre ON alumnos (carrera_id, semestre);
CREATE INDEX IF NOT EXISTS idx_alumnos_estatus ON alumnos (estatus_id);
CREATE INDEX IF NOT EXISTS idx_docentes_depto ON docentes (cve_depto);

-- 5. Datos demo (SOLO desarrollo)
INSERT INTO periodos (periodo_id, periodo, nombre_corto) VALUES (1, 'Ene-Jun 2026', 'EJ26') ON CONFLICT DO NOTHING;
INSERT INTO departamentos (cve_depto, departamento) VALUES (1, 'Sistemas y Computación') ON CONFLICT DO NOTHING;
INSERT INTO turnos (turno_id, turno) VALUES (1, 'Matutino'), (2, 'Vespertino') ON CONFLICT DO NOTHING;
INSERT INTO estatus (estatus_id, estatus) VALUES ('ACT', 'Activo'), ('BAJ', 'Baja'), ('EGR', 'Egresado') ON CONFLICT DO NOTHING;
INSERT INTO carreras (carrera_id, carrera, nombre_corto, modalidad, nivel)
VALUES (1, 'Ingeniería en Sistemas Computacionales', 'ISC', 'Escolarizada', 'Licenciatura') ON CONFLICT DO NOTHING;
INSERT INTO plan_estudios (plan_est_id, carrera_id, plan_est, modalidad)
VALUES (1, 1, 'ISIC-2010-224', 'Escolarizada') ON CONFLICT DO NOTHING;
INSERT INTO especialidades (especialidad_id, carrera_id, especialidad, vigente)
VALUES (1, 1, 'Sin especialidad', true) ON CONFLICT DO NOTHING;
INSERT INTO asignaturas (clave_materia, clave_oficial, asignatura, nombre_corto, creditos)
VALUES ('ISC-1001', 'ACF-0901', 'Cálculo Diferencial', 'Cálculo Dif.', 5) ON CONFLICT DO NOTHING;
INSERT INTO docentes (clave, nombre, apellidos, sexo, correo, tipo, cve_depto, vigente)
VALUES ('D0001', 'Usuario', 'Demo', 'M', 'usuario@tecnm.local', 'Docente', 1, true) ON CONFLICT DO NOTHING;
INSERT INTO alumnos (matricula, apellidos, nombre, sexo, semestre, carrera_id, modalidad, plan_est_id,
                     especialidad_id, estatus_id, generacion, inscrito, turno_id, periodo_ingreso, correo, seccion)
VALUES
    ('20260001', 'Pérez López', 'Ana', 'F', 3, 1, 'Escolarizada', 1, 1, 'ACT', '2025', true, 1, 1, 'a20260001@tecnm.local', 'A'),
    ('20260002', 'García Ruiz', 'Luis', 'M', 3, 1, 'Escolarizada', 1, 1, 'ACT', '2025', true, 1, 1, 'a20260002@tecnm.local', 'A')
ON CONFLICT DO NOTHING;

COMMIT;
