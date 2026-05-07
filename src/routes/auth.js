const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const passport = require('../config/passport');

const sign = (user) => jwt.sign(
  { id: user.id, email: user.email, plan: user.plan },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nom, prenom, email, password, telephone } = req.body;
  if (!nom || !prenom || !email || !password)
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  try {
    const exist = await pool.query('SELECT id FROM nc_users WHERE email=$1', [email]);
    if (exist.rows.length) return res.status(409).json({ error: 'Email déjà utilisé.' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO nc_users (nom,prenom,email,password_hash,telephone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nom, prenom, email, hash, telephone || null]
    );
    const user = result.rows[0];
    res.status(201).json({ token: sign(user), user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, plan: user.plan } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  try {
    const result = await pool.query('SELECT * FROM nc_users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Identifiants invalides.' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides.' });
    res.json({ token: sign(user), user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, plan: user.plan } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id,nom,prenom,email,telephone,plan,created_at FROM nc_users WHERE id=$1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = sign(req.user);
    res.redirect(`${process.env.FRONTEND_URL || ''}?token=${token}`);
  }
);

module.exports = router;
