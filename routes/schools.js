// routes/schools.js — Gestion des écoles
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const pool    = require('../config/db');
const auth    = require('../middlewares/auth');
const { checkSchoolLimit } = require('../middlewares/freemium');

// ══ GET /api/schools — Liste des écoles du prof ══
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, 
        COUNT(DISTINCT c.id) AS nb_classes
       FROM schools s
       LEFT JOIN classes c ON c.school_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id
       ORDER BY s.created_at ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ POST /api/schools — Créer une école ══
router.post('/', auth, checkSchoolLimit, [
  body('nom').trim().notEmpty().withMessage('Le nom de l\'école est obligatoire.'),
  body('type_ecole').isIn(['prive', 'ceg']).withMessage('Type invalide : prive ou ceg.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nom, ville, type_ecole } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO schools (user_id, nom, ville, type_ecole)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, nom, ville || null, type_ecole]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ PUT /api/schools/:id — Modifier une école ══
router.put('/:id', auth, [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.'),
  body('type_ecole').isIn(['prive', 'ceg']).withMessage('Type invalide.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nom, ville, type_ecole } = req.body;
  try {
    const result = await pool.query(
      `UPDATE schools SET nom=$1, ville=$2, type_ecole=$3
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [nom, ville || null, type_ecole, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'École introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ DELETE /api/schools/:id — Supprimer une école ══
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM schools WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'École introuvable.' });
    res.json({ message: 'École supprimée avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
