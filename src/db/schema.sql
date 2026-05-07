-- ══════════════════════════════════════════════════
--   NoteClass — Schéma base de données PostgreSQL
-- ══════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS ecoles (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom        VARCHAR(200) NOT NULL,
  ville      VARCHAR(100),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('prive', 'ceg')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classes (
  id             SERIAL PRIMARY KEY,
  ecole_id       INTEGER NOT NULL REFERENCES ecoles(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom            VARCHAR(100) NOT NULL,
  matiere        VARCHAR(100) NOT NULL,
  coefficient    INTEGER NOT NULL DEFAULT 1 CHECK (coefficient BETWEEN 1 AND 8),
  type_periode   VARCHAR(12) NOT NULL CHECK (type_periode IN ('trimestre', 'semestre')),
  annee_scolaire VARCHAR(9)  NOT NULL DEFAULT '2024-2025',
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eleves (
  id         SERIAL PRIMARY KEY,
  classe_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  nom        VARCHAR(100) NOT NULL,
  prenom     VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id         SERIAL PRIMARY KEY,
  eleve_id   INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  classe_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  periode    INTEGER NOT NULL,
  type_note  VARCHAR(20) NOT NULL CHECK (
               type_note IN ('interro1','interro2','interro3','devoir1','devoir2')
             ),
  valeur     NUMERIC(4,2) CHECK (valeur >= 0 AND valeur <= 20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(eleve_id, classe_id, periode, type_note)
);

CREATE TABLE IF NOT EXISTS appreciations (
  id          SERIAL PRIMARY KEY,
  eleve_id    INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  classe_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  periode     INTEGER NOT NULL,
  commentaire TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(eleve_id, classe_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_ecoles_user     ON ecoles(user_id);
CREATE INDEX IF NOT EXISTS idx_classes_ecole   ON classes(ecole_id);
CREATE INDEX IF NOT EXISTS idx_classes_user    ON classes(user_id);
CREATE INDEX IF NOT EXISTS idx_eleves_classe   ON eleves(classe_id);
CREATE INDEX IF NOT EXISTS idx_notes_eleve     ON notes(eleve_id);
CREATE INDEX IF NOT EXISTS idx_notes_classe    ON notes(classe_id);
CREATE INDEX IF NOT EXISTS idx_appreciations   ON appreciations(eleve_id, classe_id, periode);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_appreciations_updated_at ON appreciations;
CREATE TRIGGER trg_appreciations_updated_at
  BEFORE UPDATE ON appreciations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
