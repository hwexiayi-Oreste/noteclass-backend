const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/ecoles
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM nc_ecoles WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ecoles
router.post('/', auth, async (req, res) => {
  const { nom, ville, type } = req.body;
  if (!nom || !type) return res.status(400).json({ error: 'Nom et type requis.' });

  // Limite plan gratuit : 1 école
  if (req.user.plan === 'free') {
    const count = await pool.query('SELECT COUNT(*) FROM nc_ecoles WHERE user_id=$1', [req.user.id]);
    if (parseInt(count.rows[0].count) >= 1)
      return res.status(403).json({ error: 'Plan Découverte limité à 1 école. Passez au Plan Pro.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO nc_ecoles (user_id,nom,ville,type) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, nom, ville || null, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/ecoles/:id
router.put('/:id', auth, async (req, res) => {
  const { nom, ville, type } = req.body;
  try {
    const result = await pool.query(
      'UPDATE nc_ecoles SET nom=COALESCE($1,nom), ville=COALESCE($2,ville), type=COALESCE($3,type) WHERE id=$4 AND user_id=$5 RETURNING *',
      [nom, ville, type, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'École introuvable.' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/ecoles/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM nc_ecoles WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'École introuvable.' });
    res.json({ message: 'École supprimée.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
