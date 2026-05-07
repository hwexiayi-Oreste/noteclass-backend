// src/routes/eleves.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ──────────────────────────────────────
// Vérifier que la classe appartient au prof
// ──────────────────────────────────────
const checkClasse = async (classe_id, user_id) => {
  const r = await query(
    'SELECT id, coefficient FROM classes WHERE id=$1 AND user_id=$2',
    [classe_id, user_id]
  );
  return r.rows[0] || null;
};

// ──────────────────────────────────────
// GET /api/eleves?classe_id=X
// ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { classe_id } = req.query;
    if (!classe_id) return res.status(400).json({ error: 'classe_id requis.' });

    // Vérifier accès
    const classe = await checkClasse(classe_id, req.user.id);
    if (!classe) return res.status(403).json({ error: 'Accès non autorisé.' });

    const result = await query(
      `SELECT id, nom, prenom, created_at
       FROM eleves WHERE classe_id = $1
       ORDER BY nom, prenom`,
      [classe_id]
    );

    res.json({ eleves: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// POST /api/eleves  →  Ajouter un élève
// ──────────────────────────────────────
router.post('/', [
  body('classe_id').isInt().withMessage('classe_id obligatoire.'),
  body('nom').trim().notEmpty().withMessage('Nom obligatoire.'),
  body('prenom').trim().notEmpty().withMessage('Prénom obligatoire.'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { classe_id, nom, prenom } = req.body;

    // Vérifier accès
    const classe = await checkClasse(classe_id, req.user.id);
    if (!classe) return res.status(403).json({ error: 'Accès non autorisé.' });

    // Limite plan gratuit : 10 élèves max par classe
    if (req.user.plan === 'free') {
      const count = await query(
        'SELECT COUNT(*) FROM eleves WHERE classe_id = $1',
        [classe_id]
      );
      if (parseInt(count.rows[0].count) >= 10) {
        return res.status(403).json({
          error: 'Plan Découverte : 10 élèves maximum par classe. Passez au plan Pro pour ajouter plus d\'élèves.',
          upgrade: true,
        });
      }
    }

    const result = await query(
      `INSERT INTO eleves (classe_id, nom, prenom)
       VALUES ($1, $2, $3) RETURNING *`,
      [classe_id, nom.toUpperCase(), prenom]
    );

    res.status(201).json({ eleve: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// PUT /api/eleves/:id  →  Modifier
// ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { nom, prenom } = req.body;
    // Vérifier que l'élève appartient à une classe du prof
    const result = await query(
      `UPDATE eleves SET nom=$1, prenom=$2
       WHERE id=$3
       AND classe_id IN (SELECT id FROM classes WHERE user_id=$4)
       RETURNING *`,
      [nom.toUpperCase(), prenom, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Élève introuvable.' });
    res.json({ eleve: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// DELETE /api/eleves/:id
// ──────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM eleves WHERE id=$1
       AND classe_id IN (SELECT id FROM classes WHERE user_id=$2)
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Élève introuvable.' });
    res.json({ message: 'Élève supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
