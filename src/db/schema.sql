-- ══════════════════════════════════════════════════
--   NoteClass — Schéma base de données PostgreSQL
-- ══════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS nc_users (
  id            SERIAL PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id     VARCHAR(255) UNIQUE,
  telephone     VARCHAR(30),
  plan          VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nc_ecoles (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES nc_users(id) ON DELETE CASCADE,
  nom        VARCHAR(200) NOT NULL,
  ville      VARCHAR(100),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('prive', 'ceg')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nc_classes (
  id             SERIAL PRIMARY KEY,
  ecole_id       INTEGER NOT NULL REFERENCES nc_ecoles(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES nc_users(id) ON DELETE CASCADE,
  nom            VARCHAR(100) NOT NULL,
  matiere        VARCHAR(100) NOT NULL,
  coefficient    INTEGER NOT NULL DEFAULT 1 CHECK (coefficient BETWEEN 1 AND 8),
  type_periode   VARCHAR(12) NOT NULL CHECK (type_periode IN ('trimestre', 'semestre')),
  annee_scolaire VARCHAR(9)  NOT NULL DEFAULT '2024-2025',
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nc_eleves (
  id         SERIAL PRIMARY KEY,
  classe_id  INTEGER NOT NULL REFERENCES nc_classes(id) ON DELETE CASCADE,
  nom        VARCHAR(100) NOT NULL,
  prenom     VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nc_notes (
  id         SERIAL PRIMARY KEY,
  eleve_id   INTEGER NOT NULL REFERENCES nc_eleves(id) ON DELETE CASCADE,
  classe_id  INTEGER NOT NULL REFERENCES nc_classes(id) ON DELETE CASCADE,
  periode    INTEGER NOT NULL,
  type_note  VARCHAR(20) NOT NULL CHECK (
               type_note IN ('interro1','interro2','interro3','devoir1','devoir2')
             ),
  valeur     NUMERIC(4,2) CHECK (valeur >= 0 AND valeur <= 20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(eleve_id, classe_id, periode, type_note)
);

CREATE TABLE IF NOT EXISTS nc_appreciations (
  id          SERIAL PRIMARY KEY,
  eleve_id    INTEGER NOT NULL REFERENCES nc_eleves(id) ON DELETE CASCADE,
  classe_id   INTEGER NOT NULL REFERENCES nc_classes(id) ON DELETE CASCADE,
  periode     INTEGER NOT NULL,
  commentaire TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(eleve_id, classe_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_nc_ecoles_user     ON nc_ecoles(user_id);
CREATE INDEX IF NOT EXISTS idx_nc_classes_ecole   ON nc_classes(ecole_id);
CREATE INDEX IF NOT EXISTS idx_nc_classes_user    ON nc_classes(user_id);
CREATE INDEX IF NOT EXISTS idx_nc_eleves_classe   ON nc_eleves(classe_id);
CREATE INDEX IF NOT EXISTS idx_nc_notes_eleve     ON nc_notes(eleve_id);
CREATE INDEX IF NOT EXISTS idx_nc_notes_classe    ON nc_notes(classe_id);
CREATE INDEX IF NOT EXISTS idx_nc_appreciations   ON nc_appreciations(eleve_id, classe_id, periode);

CREATE OR REPLACE FUNCTION nc_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nc_users_updated_at ON nc_users;
CREATE TRIGGER trg_nc_users_updated_at
  BEFORE UPDATE ON nc_users
  FOR EACH ROW EXECUTE FUNCTION nc_update_updated_at();

DROP TRIGGER IF EXISTS trg_nc_notes_updated_at ON nc_notes;
CREATE TRIGGER trg_nc_notes_updated_at
  BEFORE UPDATE ON nc_notes
  FOR EACH ROW EXECUTE FUNCTION nc_update_updated_at();

DROP TRIGGER IF EXISTS trg_nc_appreciations_updated_at ON nc_appreciations;
CREATE TRIGGER trg_nc_appreciations_updated_at
  BEFORE UPDATE ON nc_appreciations
  FOR EACH ROW EXECUTE FUNCTION nc_update_updated_at();

CREATE TABLE IF NOT EXISTS nc_password_resets (
  user_id    INTEGER PRIMARY KEY REFERENCES nc_users(id) ON DELETE CASCADE,
  token      VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
