-- ══════════════════════════════════════════════
-- NoteClass — Schéma base de données PostgreSQL
-- À exécuter une seule fois sur votre base Render
-- ══════════════════════════════════════════════

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLE UTILISATEURS (Professeurs) ──────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),           -- NULL si connexion Google
  google_id     VARCHAR(255) UNIQUE,    -- NULL si connexion email
  telephone     VARCHAR(20),
  plan          VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ── TABLE ÉCOLES ──────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom         VARCHAR(200) NOT NULL,
  ville       VARCHAR(100),
  type_ecole  VARCHAR(10) NOT NULL CHECK (type_ecole IN ('prive', 'ceg')),
  -- prive = trimestres, ceg = semestres
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ── TABLE CLASSES ──────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom           VARCHAR(100) NOT NULL,       -- Ex: "6ème A"
  matiere       VARCHAR(100) NOT NULL,       -- Ex: "Mathématiques"
  coefficient   INTEGER NOT NULL DEFAULT 1 CHECK (coefficient BETWEEN 1 AND 8),
  annee_scolaire VARCHAR(9) NOT NULL,        -- Ex: "2024-2025"
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ── TABLE ÉLÈVES ──────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom         VARCHAR(100) NOT NULL,
  prenom      VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── TABLE NOTES ───────────────────────────────
CREATE TABLE IF NOT EXISTS grades (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  periode      INTEGER NOT NULL CHECK (periode IN (1, 2, 3)),
  -- periode = 1,2,3 pour trimestres | 1,2 pour semestres
  interro1     NUMERIC(4,2) CHECK (interro1 BETWEEN 0 AND 20),
  interro2     NUMERIC(4,2) CHECK (interro2 BETWEEN 0 AND 20),
  interro3     NUMERIC(4,2) CHECK (interro3 BETWEEN 0 AND 20),
  devoir1      NUMERIC(4,2) CHECK (devoir1 BETWEEN 0 AND 20),
  devoir2      NUMERIC(4,2) CHECK (devoir2 BETWEEN 0 AND 20),
  moyenne      NUMERIC(4,2),             -- Calculée automatiquement
  appreciation VARCHAR(20),              -- TB, B, AB, P, I, TI
  commentaire  TEXT,
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE (student_id, periode)           -- Une seule fiche par élève par période
);

-- ── INDEX pour meilleures performances ────────
CREATE INDEX IF NOT EXISTS idx_schools_user    ON schools(user_id);
CREATE INDEX IF NOT EXISTS idx_classes_school  ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_user    ON classes(user_id);
CREATE INDEX IF NOT EXISTS idx_students_class  ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student  ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_class    ON grades(class_id);

-- ── FONCTION mise à jour automatique updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schools_updated  BEFORE UPDATE ON schools  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_classes_updated  BEFORE UPDATE ON classes  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_grades_updated   BEFORE UPDATE ON grades   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
