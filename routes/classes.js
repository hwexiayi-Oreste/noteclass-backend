// routes/classes.js — Gestion des classes
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const pool    = require('../config/db');
const auth    = require('../middlewares/auth');

// ══ GET /api/classes — Toutes les classes du prof ══
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
         s.nom AS school_nom, s.type_ecole, s.ville,
         COUNT(DISTINCT st.id) AS nb_eleves
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       LEFT JOIN students st ON st.class_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id, s.nom, s.type_ecole, s.ville
       ORDER BY s.nom, c.nom`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ GET /api/classes/school/:school_id — Classes d'une école ══
router.get('/school/:school_id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
         COUNT(DISTINCT st.id) AS nb_eleves
       FROM classes c
       LEFT JOIN students st ON st.class_id = c.id
       WHERE c.school_id = $1 AND c.user_id = $2
       GROUP BY c.id
       ORDER BY c.nom`,
      [req.params.school_id, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ GET /api/classes/:id — Détail d'une classe ══
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
         s.nom AS school_nom, s.type_ecole, s.ville
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       WHERE c.id = $1 AND c.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Classe introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ POST /api/classes — Créer une classe ══
router.post('/', auth, [
  body('school_id').notEmpty().withMessage('L\'école est obligatoire.'),
  body('nom').trim().notEmpty().withMessage('Le nom de la classe est obligatoire.'),
  body('matiere').trim().notEmpty().withMessage('La matière est obligatoire.'),
  body('coefficient').isInt({ min: 1, max: 8 }).withMessage('Le coefficient doit être entre 1 et 8.'),
  body('annee_scolaire').matches(/^\d{4}-\d{4}$/).withMessage('Format annee_scolaire : 2024-2025'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { school_id, nom, matiere, coefficient, annee_scolaire } = req.body;

  try {
    // Vérifier que l'école appartient au prof
    const schoolCheck = await pool.query(
      'SELECT id FROM schools WHERE id = $1 AND user_id = $2',
      [school_id, req.user.id]
    );
    if (schoolCheck.rows.length === 0) {
      return res.status(403).json({ message: 'École introuvable ou accès refusé.' });
    }

    const result = await pool.query(
      `INSERT INTO classes (school_id, user_id, nom, matiere, coefficient, annee_scolaire)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [school_id, req.user.id, nom, matiere, coefficient, annee_scolaire]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ PUT /api/classes/:id — Modifier une classe ══
router.put('/:id', auth, [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.'),
  body('matiere').trim().notEmpty().withMessage('La matière est obligatoire.'),
  body('coefficient').isInt({ min: 1, max: 8 }).withMessage('Coefficient invalide.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nom, matiere, coefficient, annee_scolaire } = req.body;
  try {
    const result = await pool.query(
      `UPDATE classes SET nom=$1, matiere=$2, coefficient=$3, annee_scolaire=$4
       WHERE id=$5 AND user_id=$6 RETURNING *`,
      [nom, matiere, coefficient, annee_scolaire, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Classe introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ DELETE /api/classes/:id ══
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM classes WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Classe introuvable.' });
    res.json({ message: 'Classe supprimée.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
