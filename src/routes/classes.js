// src/routes/classes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ──────────────────────────────────────
// GET /api/classes?ecole_id=X
// ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { ecole_id } = req.query;
    let sql = `
      SELECT c.*, e.nom AS ecole_nom, e.type AS ecole_type,
             COUNT(el.id) AS nb_eleves
      FROM classes c
      JOIN ecoles e ON e.id = c.ecole_id
      LEFT JOIN eleves el ON el.classe_id = c.id
      WHERE c.user_id = $1
    `;
    const params = [req.user.id];

    if (ecole_id) {
      sql += ` AND c.ecole_id = $2`;
      params.push(ecole_id);
    }

    sql += ` GROUP BY c.id, e.nom, e.type ORDER BY c.created_at DESC`;

    const result = await query(sql, params);
    res.json({ classes: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// GET /api/classes/:id  →  Détail classe
// ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, e.nom AS ecole_nom, e.type AS ecole_type
       FROM classes c JOIN ecoles e ON e.id = c.ecole_id
       WHERE c.id = $1 AND c.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Classe introuvable.' });
    res.json({ classe: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// POST /api/classes  →  Créer une classe
// ──────────────────────────────────────
router.post('/', [
  body('ecole_id').isInt().withMessage('École obligatoire.'),
  body('nom').trim().notEmpty().withMessage('Nom de classe obligatoire.'),
  body('matiere').trim().notEmpty().withMessage('Matière obligatoire.'),
  body('coefficient').isInt({ min: 1, max: 8 }).withMessage('Coefficient entre 1 et 8.'),
  body('type_periode').isIn(['trimestre', 'semestre']).withMessage('Type de période invalide.'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Vérifier que l'école appartient au prof
    const ecoleCheck = await query(
      'SELECT id FROM ecoles WHERE id=$1 AND user_id=$2',
      [req.body.ecole_id, req.user.id]
    );
    if (ecoleCheck.rows.length === 0)
      return res.status(403).json({ error: 'École non autorisée.' });

    const { ecole_id, nom, matiere, coefficient, type_periode, annee_scolaire } = req.body;

    const result = await query(
      `INSERT INTO classes (ecole_id, user_id, nom, matiere, coefficient, type_periode, annee_scolaire)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [ecole_id, req.user.id, nom, matiere, coefficient, type_periode, annee_scolaire || '2024-2025']
    );

    res.status(201).json({ classe: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// PUT /api/classes/:id  →  Modifier
// ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { nom, matiere, coefficient, type_periode, annee_scolaire } = req.body;
    const result = await query(
      `UPDATE classes
       SET nom=$1, matiere=$2, coefficient=$3, type_periode=$4, annee_scolaire=$5
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [nom, matiere, coefficient, type_periode, annee_scolaire, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Classe introuvable.' });
    res.json({ classe: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// DELETE /api/classes/:id
// ──────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM classes WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Classe introuvable.' });
    res.json({ message: 'Classe supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
