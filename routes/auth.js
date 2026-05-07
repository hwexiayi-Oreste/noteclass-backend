// routes/auth.js — Authentification (email + Google OAuth)
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const pool     = require('../config/db');

// ── Générer un token JWT ────────────────────────
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ══════════════════════════════════════════
// POST /api/auth/inscription
// ══════════════════════════════════════════
router.post('/inscription', [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire.'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide.'),
  body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { nom, prenom, email, password, telephone } = req.body;

  try {
    // Vérifier si l'email existe déjà
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }

    // Hasher le mot de passe
    const password_hash = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const result = await pool.query(
      `INSERT INTO users (nom, prenom, email, password_hash, telephone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nom, prenom, email, plan, created_at`,
      [nom.toUpperCase(), prenom, email, password_hash, telephone || null]
    );

    const user  = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Compte créé avec succès.',
      token,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, plan: user.plan },
    });

  } catch (err) {
    console.error('Erreur inscription :', err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══════════════════════════════════════════
// POST /api/auth/connexion
// ══════════════════════════════════════════
router.post('/connexion', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide.'),
  body('password').notEmpty().withMessage('Mot de passe obligatoire.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const user = result.rows[0];

    // Vérifier que c'est un compte email (pas Google uniquement)
    if (!user.password_hash) {
      return res.status(401).json({
        message: 'Ce compte utilise la connexion Google. Veuillez vous connecter avec Google.',
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Connexion réussie.',
      token,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, plan: user.plan },
    });

  } catch (err) {
    console.error('Erreur connexion :', err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ══════════════════════════════════════════
// GET /api/auth/google  — Redirection vers Google
// ══════════════════════════════════════════
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ══════════════════════════════════════════
// GET /api/auth/google/callback
// ══════════════════════════════════════════
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=google' }),
  (req, res) => {
    const token = generateToken(req.user.id);
    // Rediriger vers le frontend avec le token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?token=${token}`);
  }
);

// ══════════════════════════════════════════
// GET /api/auth/me — Profil utilisateur connecté
// ══════════════════════════════════════════
const authMiddleware = require('../middlewares/auth');
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nom, prenom, email, telephone, plan, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
