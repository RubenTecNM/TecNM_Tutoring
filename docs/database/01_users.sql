BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(64) NOT NULL,
    email varchar(254) NOT NULL,
    password varchar(512) NOT NULL,
    name varchar(160) NOT NULL,
    role varchar(16) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('Admin', 'User'))
);

INSERT INTO users (id, username, email, password, name, role, is_active)
VALUES
    (
        '10000000-0000-4000-8000-000000000001',
        'admin',
        'admin@tecnm.local',
        'AQAAAAIAAYagAAAAEBNPxud6jX7QP1g34USJAlSAOJsyjHIeTAhoy4NdjwIvlomPzIgRfKtbJikHIXH/MA==',
        'Lic. María Fernanda López Garza',
        'Admin',
        true
    ),
    (
        '10000000-0000-4000-8000-000000000002',
        'usuario',
        'usuario@tecnm.local',
        'AQAAAAIAAYagAAAAEBNPxud6jX7QP1g34USJAlSAOJsyjHIeTAhoy4NdjwIvlomPzIgRfKtbJikHIXH/MA==',
        'Ing. Carlos Alberto Mendoza Gómez',
        'User',
        true
    ),
    (
        '10000000-0000-4000-8000-000000000003',
        'usuario2',
        'usuario2@tecnm.local',
        'AQAAAAIAAYagAAAAEBNPxud6jX7QP1g34USJAlSAOJsyjHIeTAhoy4NdjwIvlomPzIgRfKtbJikHIXH/MA==',
        'M.C. Laura Elena Sánchez Morales',
        'User',
        true
    )
ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password = EXCLUDED.password,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- Llave lógica -> tecnm_main.docentes.clave (sin FK: BD distinta). NULL = no es docente.
ALTER TABLE users ADD COLUMN IF NOT EXISTS docente_clave varchar(5) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_docente_clave ON users (docente_clave);
UPDATE users SET docente_clave = 'D0001' WHERE username = 'usuario' AND docente_clave IS NULL; -- demo
UPDATE users SET docente_clave = 'D0002' WHERE username = 'usuario2' AND docente_clave IS NULL; -- demo 2

COMMIT;
