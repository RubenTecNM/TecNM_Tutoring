-- =============================================================================
-- BASE DE DATOS INDEPENDIENTE: TUTORÍAS TecNM
-- Motor: PostgreSQL 16+
-- Propósito: Almacenar datos exclusivos de Tutorías (Cumplimiento, Canalizaciones
--            y Métricas), enlazando llaves lógicas con la BD Principal.
-- =============================================================================

BEGIN;

-- 1. Extensiones necesarias para UUIDs criptográficos
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Función Trigger para actualización automática del campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLA 1: tutoring_deliverables (Módulo de Cumplimiento Docente)
-- Referencias lógicas a la BD Principal:
--   - docente_clave  -> Docentes.Clave
--   - periodo_id     -> Periodos.PeriodoID
--   - file_id        -> Files.ID (Nullable, hasta que se suba el archivo)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tutoring_deliverables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docente_clave varchar(64) NOT NULL,
    periodo_id integer NOT NULL,
    file_id integer NULL,
    report_type varchar(32) NOT NULL,
    reporting_month smallint NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'Pending',
    delay_days integer NOT NULL DEFAULT 0,
    
    -- Campos de Auditoría Inmutable (Estándar TecNM)
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by varchar(254) NOT NULL,
    created_ip varchar(45) NOT NULL,
    updated_at timestamptz NULL,
    updated_by varchar(254) NULL,
    updated_ip varchar(45) NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by varchar(254) NULL,
    deleted_ip varchar(45) NULL,

    -- Restricciones de Dominio e Integridad
    CONSTRAINT chk_deliverables_month CHECK (reporting_month BETWEEN 1 AND 12),
    CONSTRAINT chk_deliverables_status CHECK (status IN ('Pending', 'OnTime', 'Late')),
    CONSTRAINT chk_deliverables_report_type CHECK (
        report_type IN (
            'PlanTrabajo',
            'DiagnosticoInicial',
            'Anexo14',
            'Anexo15',
            'Anexo19AMensual',
            'Asistencia',
            'Anexo19Final'
        )
    )
);

-- Índices de optimización de lectura
CREATE INDEX IF NOT EXISTS idx_deliverables_docente_periodo 
    ON tutoring_deliverables (docente_clave, periodo_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_deliverables_status_month 
    ON tutoring_deliverables (status, reporting_month) WHERE is_deleted = false;

-- Trigger para mantener updated_at automáticamente
DROP TRIGGER IF EXISTS trg_tutoring_deliverables_updated_at ON tutoring_deliverables;
CREATE TRIGGER trg_tutoring_deliverables_updated_at
    BEFORE UPDATE ON tutoring_deliverables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLA 2: tutoring_referrals (Módulo de Canalizaciones a Áreas de Apoyo)
-- Referencias lógicas a la BD Principal:
--   - periodo_id  -> Periodos.PeriodoID
--   - matricula   -> Alumnos.Matricula
--   - tutor_clave -> Docentes.Clave
-- =============================================================================
CREATE TABLE IF NOT EXISTS tutoring_referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_id integer NOT NULL,
    matricula varchar(32) NOT NULL,
    tutor_clave varchar(64) NOT NULL,
    detection_source varchar(32) NOT NULL,
    support_area varchar(32) NOT NULL,
    referral_reason varchar(32) NOT NULL,
    observations text NULL,
    contact_phone varchar(20) NULL,
    status varchar(16) NOT NULL DEFAULT 'InTracking',
    
    -- Campos de Auditoría Inmutable (Estándar TecNM)
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by varchar(254) NOT NULL,
    created_ip varchar(45) NOT NULL,
    updated_at timestamptz NULL,
    updated_by varchar(254) NULL,
    updated_ip varchar(45) NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by varchar(254) NULL,
    deleted_ip varchar(45) NULL,

    -- Restricciones de Dominio e Integridad
    CONSTRAINT chk_referrals_source CHECK (detection_source IN ('Tutor', 'Maestro')),
    CONSTRAINT chk_referrals_area CHECK (support_area IN ('Psychology', 'SocialWork', 'Nursing', 'Tutoring')),
    CONSTRAINT chk_referrals_reason CHECK (referral_reason IN ('Academic', 'Emotional', 'Personal', 'Discipline')),
    CONSTRAINT chk_referrals_status CHECK (status IN ('InTracking', 'Resolved'))
);

-- Índices de optimización para búsquedas por estudiante y bandeja por área
CREATE INDEX IF NOT EXISTS idx_referrals_student_history 
    ON tutoring_referrals (matricula, periodo_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_referrals_area_status 
    ON tutoring_referrals (support_area, status) WHERE is_deleted = false;

-- Trigger para mantener updated_at automáticamente
DROP TRIGGER IF EXISTS trg_tutoring_referrals_updated_at ON tutoring_referrals;
CREATE TRIGGER trg_tutoring_referrals_updated_at
    BEFORE UPDATE ON tutoring_referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLA 3: tutoring_failure_reports (Módulo de Métricas e Índices de Reprobación)
-- Referencias lógicas a la BD Principal:
--   - periodo_id    -> Periodos.PeriodoID
--   - docente_clave -> Docentes.Clave
--   - clave_materia -> Asignaturas.ClaveMateria
-- =============================================================================
CREATE TABLE IF NOT EXISTS tutoring_failure_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_id integer NOT NULL,
    docente_clave varchar(64) NOT NULL,
    clave_materia varchar(32) NOT NULL,
    grupo varchar(16) NOT NULL,
    reporting_month smallint NOT NULL,
    total_students integer NOT NULL,
    failed_students integer NOT NULL,
    failure_percentage numeric(5,2) NOT NULL DEFAULT 0.00,
    failed_units varchar(64) NULL,
    risk_level varchar(16) NOT NULL DEFAULT 'Low',
    preventive_actions text NULL,
    
    -- Campos de Auditoría Inmutable (Estándar TecNM)
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by varchar(254) NOT NULL,
    created_ip varchar(45) NOT NULL,
    updated_at timestamptz NULL,
    updated_by varchar(254) NULL,
    updated_ip varchar(45) NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz NULL,
    deleted_by varchar(254) NULL,
    deleted_ip varchar(45) NULL,

    -- Restricciones de Dominio e Integridad
    CONSTRAINT chk_failure_month CHECK (reporting_month BETWEEN 1 AND 12),
    CONSTRAINT chk_failure_total_students CHECK (total_students >= 0),
    CONSTRAINT chk_failure_failed_students CHECK (failed_students >= 0 AND failed_students <= total_students),
    CONSTRAINT chk_failure_percentage CHECK (failure_percentage BETWEEN 0.00 AND 100.00),
    CONSTRAINT chk_failure_risk_level CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical'))
);

-- Índices de optimización para métricas por materia y semáforos de riesgo
CREATE INDEX IF NOT EXISTS idx_failure_reports_materia_month 
    ON tutoring_failure_reports (clave_materia, reporting_month, periodo_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_failure_reports_risk 
    ON tutoring_failure_reports (risk_level) WHERE is_deleted = false;

-- Trigger para mantener updated_at automáticamente
DROP TRIGGER IF EXISTS trg_tutoring_failure_reports_updated_at ON tutoring_failure_reports;
CREATE TRIGGER trg_tutoring_failure_reports_updated_at
    BEFORE UPDATE ON tutoring_failure_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;