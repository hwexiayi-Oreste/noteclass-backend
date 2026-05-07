// routes/students.js — Gestion des élèves
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const pool    = require('../config/db');
const auth    = require('../middlewares/auth');
const { checkStudentLimit } = require('../middlewares/freemium');

// ══ GET /api/students/class/:class_id — Élèves d'une classe ══
router.get('/class/:class_id', auth, async (req, res) => {
  try {
    // Vérifier que la classe appartient au prof
    const classCheck = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND user_id = $2',
      [req.params.class_id, req.user.id]
    );
    if (classCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Classe introuvable ou accès refusé.' });
    }

    const result = await pool.query(
      `SELECT s.*
       FROM students s
       WHERE s.class_id = $1 AND s.user_id = $2
       ORDER BY s.nom, s.prenom`,
      [req.params.class_id, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ POST /api/students — Ajouter un élève ══
router.post('/', auth, checkStudentLimit, [
  body('class_id').notEmpty().withMessage('La classe est obligatoire.'),
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { class_id, nom, prenom } = req.body;

  try {
    // Vérifier que la classe appartient au prof
    const classCheck = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND user_id = $2',
      [class_id, req.user.id]
    );
    if (classCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Classe introuvable ou accès refusé.' });
    }

    const result = await pool.query(
      `INSERT INTO students (class_id, user_id, nom, prenom)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [class_id, req.user.id, nom.toUpperCase(), prenom]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ PUT /api/students/:id — Modifier un élève ══
router.put('/:id', auth, [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nom, prenom } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students SET nom=$1, prenom=$2
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [nom.toUpperCase(), prenom, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Élève introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══ DELETE /api/students/:id — Supprimer un élève ══
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM students WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Élève introuvable.' });
    res.json({ message: 'Élève supprimé.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
