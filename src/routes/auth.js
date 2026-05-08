const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../db');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Email de bienvenue (en arrière-plan)
    resend.emails.send({
      from: 'NoteClass <onboarding@resend.dev>',
      to: email,
      subject: 'Bienvenue sur NoteClass 🎓',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f5f6fa;border-radius:16px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;background:#1A237E;border-radius:14px;padding:14px 20px">
              <span style="color:white;font-size:22px;font-weight:900;font-family:Georgia,serif">NoteClass</span>
            </div>
          </div>
          <h2 style="color:#1A237E;font-family:Georgia,serif;margin-bottom:8px">Bienvenue, ${prenom} ${nom} ! 👋</h2>
          <p style="color:#444;line-height:1.6">Votre compte NoteClass a été créé avec succès. Vous pouvez maintenant gérer vos notes scolaires facilement.</p>
          <div style="background:white;border-radius:12px;padding:20px;margin:24px 0;border:1px solid #e8edf2">
            <p style="margin:0 0 8px;font-weight:700;color:#1A237E">Votre plan actuel : Découverte (Gratuit)</p>
            <ul style="margin:0;padding-left:20px;color:#555;line-height:2">
              <li>1 école</li>
              <li>2 classes par école</li>
              <li>25 élèves par classe</li>
              <li>Calcul automatique des moyennes</li>
              <li>Appréciations automatiques</li>
            </ul>
          </div>
          <div style="text-align:center;margin:24px 0">
            <a href="https://hwexiayi-oreste.github.io/noteclass-frontend/noteclass-dashboard.html"
              style="display:inline-block;background:#1A237E;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
              Accéder à mon espace
            </a>
          </div>
          <p style="color:#888;font-size:12px;text-align:center;margin-top:24px;border-top:1px solid #ddd;padding-top:16px">
            NoteClass — Gestion des notes scolaires au Bénin
          </p>
        </div>
      `
    }).catch(err => console.error('Email bienvenue error:', err.message));

    res.status(201).json({
      token: sign(user),
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, plan: user.plan }
    });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
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
    res.json({
      token: sign(user),
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, plan: user.plan }
    });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Erreur de connexion.' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,nom,prenom,email,telephone,plan,created_at FROM nc_users WHERE id=$1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect('https://hwexiayi-oreste.github.io/noteclass-frontend/noteclass-auth.html?error=google_non_configure');
  }
  const passport = require('../config/passport');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect('https://hwexiayi-oreste.github.io/noteclass-frontend/noteclass-auth.html?error=google_non_configure');
  }
  const passport = require('../config/passport');
  passport.authenticate('google', { session: false },
    (err, user) => {
      if (err || !user) {
        return res.redirect('https://hwexiayi-oreste.github.io/noteclass-frontend/noteclass-auth.html?error=google_echec');
      }
      const token = jwt.sign(
        { id: user.id, email: user.email, plan: user.plan },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      res.redirect(`https://hwexiayi-oreste.github.io/noteclass-frontend/noteclass-auth.html?token=${token}`);
    }
  )(req, res, next);
});

module.exports = router;
