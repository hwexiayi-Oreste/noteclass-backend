// src/routes/ecoles.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes nécessitent d'être connecté
router.use(authMiddleware);

// ──────────────────────────────────────
// GET /api/ecoles  →  Lister mes écoles
// ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, COUNT(c.id) AS nb_classes
       FROM ecoles e
       LEFT JOIN classes c ON c.ecole_id = e.id
       WHERE e.user_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ ecoles: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// POST /api/ecoles  →  Créer une école
// ──────────────────────────────────────
router.post('/', [
  body('nom').trim().notEmpty().withMessage('Le nom de l\'école est obligatoire.'),
  body('type').isIn(['prive', 'ceg']).withMessage('Type invalide (prive ou ceg).'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Vérifier la limite plan gratuit : 1 école max
    if (req.user.plan === 'free') {
      const count = await query('SELECT COUNT(*) FROM ecoles WHERE user_id = $1', [req.user.id]);
      if (parseInt(count.rows[0].count) >= 1) {
        return res.status(403).json({
          error: 'Plan Découverte : 1 école maximum. Passez au plan Pro pour ajouter plusieurs écoles.',
          upgrade: true,
        });
      }
    }

    const { nom, ville, type } = req.body;
    const result = await query(
      `INSERT INTO ecoles (user_id, nom, ville, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, nom, ville || null, type]
    );

    res.status(201).json({ ecole: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// PUT /api/ecoles/:id  →  Modifier
// ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { nom, ville, type } = req.body;
    const result = await query(
      `UPDATE ecoles SET nom=$1, ville=$2, type=$3
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [nom, ville || null, type, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'École introuvable.' });
    res.json({ ecole: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// DELETE /api/ecoles/:id  →  Supprimer
// ──────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM ecoles WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'École introuvable.' });
    res.json({ message: 'École supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
