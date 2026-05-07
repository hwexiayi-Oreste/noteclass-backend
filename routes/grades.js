// routes/grades.js — Saisie des notes et calcul des moyennes
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const pool    = require('../config/db');
const auth    = require('../middlewares/auth');

// ══ CALCUL MOYENNE ═════════════════════════════
function calculerMoyenne(i1, i2, i3, d1, d2) {
  const interros = [i1, i2, i3].filter(v => v !== null && v !== undefined && v !== '');
  const devoirs  = [d1, d2].filter(v => v !== null && v !== undefined && v !== '');

  const moyI = interros.length > 0
    ? interros.reduce((a, b) => a + parseFloat(b), 0) / interros.length
    : null;

  const moyD = devoirs.length > 0
    ? devoirs.reduce((a, b) => a + parseFloat(b), 0) / devoirs.length
    : null;

  if (moyI === null && moyD === null) return null;

  let total = 0, poids = 0;
  if (moyI !== null) { total += moyI; poids++; }
  if (moyD !== null) { total += moyD; poids++; }

  return Math.round((total / poids) * 100) / 100;
}

// ══ APPRÉCIATION ═══════════════════════════════
function getAppreciation(moy) {
  if (moy === null) return null;
  if (moy >= 16) return 'TB';
  if (moy >= 14) return 'B';
  if (moy >= 12) return 'AB';
  if (moy >= 10) return 'P';
  if (moy >= 8)  return 'I';
  return 'TI';
}

// ══ GET /api/grades/class/:class_id/periode/:periode ══
// Récupérer toutes les notes d'une classe pour une période
router.get('/class/:class_id/periode/:periode', auth, async (req, res) => {
  try {
    const { class_id, periode } = req.params;

    // Vérifier accès à la classe
    const classCheck = await pool.query(
      'SELECT id FROM classes WHERE id=$1 AND user_id=$2',
      [class_id, req.user.id]
    );
    if (classCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    // Récupérer élèves + leurs notes (jointure)
    const result = await pool.query(
      `SELECT
         st.id AS student_id, st.nom, st.prenom,
         g.id AS grade_id, g.periode,
         g.interro1, g.interro2, g.interro3,
         g.devoir1, g.devoir2,
         g.moyenne, g.appreciation, g.commentaire
       FROM students st
       LEFT JOIN grades g ON g.student_id = st.id AND g.periode = $2 AND g.class_id = $1
       WHERE st.class_id = $1 AND st.user_id = $3
       ORDER BY st.nom, st.prenom`,
      [class_id, periode, req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ POST /api/grades — Sauvegarder les notes d'un élève ══
router.post('/', auth, [
  body('student_id').notEmpty(),
  body('class_id').notEmpty(),
  body('periode').isInt({ min: 1, max: 3 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { student_id, class_id, periode, interro1, interro2, interro3, devoir1, devoir2, commentaire } = req.body;

  try {
    // Vérifier que l'élève et la classe appartiennent au prof
    const check = await pool.query(
      `SELECT st.id FROM students st
       JOIN classes c ON c.id = st.class_id
       WHERE st.id=$1 AND st.class_id=$2 AND st.user_id=$3`,
      [student_id, class_id, req.user.id]
    );
    if (check.rows.length === 0) return res.status(403).json({ message: 'Accès refusé.' });

    // Calculer moyenne + appréciation
    const moyenne     = calculerMoyenne(interro1, interro2, interro3, devoir1, devoir2);
    const appreciation = getAppreciation(moyenne);

    // UPSERT (insérer ou mettre à jour si déjà existant)
    const result = await pool.query(
      `INSERT INTO grades
         (student_id, class_id, user_id, periode, interro1, interro2, interro3, devoir1, devoir2, moyenne, appreciation, commentaire)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (student_id, periode)
       DO UPDATE SET
         interro1=$5, interro2=$6, interro3=$7,
         devoir1=$8, devoir2=$9,
         moyenne=$10, appreciation=$11,
         commentaire=$12, updated_at=NOW()
       RETURNING *`,
      [student_id, class_id, req.user.id, periode,
       interro1||null, interro2||null, interro3||null,
       devoir1||null, devoir2||null,
       moyenne, appreciation, commentaire||null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ POST /api/grades/batch — Sauvegarder toute une classe en une fois ══
router.post('/batch', auth, async (req, res) => {
  const { class_id, periode, notes } = req.body;
  // notes = [{ student_id, interro1, interro2, interro3, devoir1, devoir2, commentaire }]

  if (!class_id || !periode || !Array.isArray(notes)) {
    return res.status(400).json({ message: 'Données invalides.' });
  }

  try {
    // Vérifier accès à la classe
    const classCheck = await pool.query(
      'SELECT id FROM classes WHERE id=$1 AND user_id=$2',
      [class_id, req.user.id]
    );
    if (classCheck.rows.length === 0) return res.status(403).json({ message: 'Accès refusé.' });

    const results = [];
    for (const note of notes) {
      const { student_id, interro1, interro2, interro3, devoir1, devoir2, commentaire } = note;
      const moyenne      = calculerMoyenne(interro1, interro2, interro3, devoir1, devoir2);
      const appreciation = getAppreciation(moyenne);

      const r = await pool.query(
        `INSERT INTO grades
           (student_id, class_id, user_id, periode, interro1, interro2, interro3, devoir1, devoir2, moyenne, appreciation, commentaire)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (student_id, periode)
         DO UPDATE SET
           interro1=$5, interro2=$6, interro3=$7,
           devoir1=$8, devoir2=$9,
           moyenne=$10, appreciation=$11,
           commentaire=$12, updated_at=NOW()
         RETURNING *`,
        [student_id, class_id, req.user.id, periode,
         interro1||null, interro2||null, interro3||null,
         devoir1||null, devoir2||null,
         moyenne, appreciation, commentaire||null]
      );
      results.push(r.rows[0]);
    }

    res.json({ message: `${results.length} notes enregistrées.`, data: results });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
