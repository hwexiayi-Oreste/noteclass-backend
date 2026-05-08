const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('../middleware/auth');

// Middleware admin — seul ton compte peut accéder
const adminOnly = async (req, res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  next();
};

// GET /api/admin/users — Liste tous les utilisateurs
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom, prenom, email, plan, telephone, created_at FROM nc_users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/users/:id/plan — Changer le plan d'un utilisateur
router.put('/users/:id/plan', auth, adminOnly, async (req, res) => {
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
