const router = require('express').Router();
const pool   = require('../db');

// Middleware admin — clé secrète uniquement, pas besoin de token utilisateur
const adminOnly = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  next();
};

// GET /api/admin/users
router.get('/users', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom, prenom, email, plan, telephone, created_at FROM nc_users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/users/:id/plan
router.put('/users/:id/plan', adminOnly, async (req, res) => {
  const { plan } = req.body;
  if (!['free', 'pro'].includes(plan))
    return res.status(400).json({ error: 'Plan invalide.' });
  try {
    const result = await pool.query(
      'UPDATE nc_users SET plan=$1 WHERE id=$2 RETURNING id, nom, prenom, email, plan',
      [plan, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ message: `Plan mis à jour : ${plan}`, user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
