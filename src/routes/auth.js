// src/routes/auth.js
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');

const router = express.Router();

// ──────────────────────────────────────
// Générer un token JWT
// ──────────────────────────────────────
const genToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ──────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────
router.post('/register', [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire.'),
  body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe : 8 caractères minimum.'),
], async (req, res) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nom, prenom, email, password, telephone } = req.body;

    // Vérifier si l'email existe déjà
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Créer l'utilisateur
    const result = await query(
      `INSERT INTO users (nom, prenom, email, password_hash, telephone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nom, prenom, email, plan, created_at`,
      [nom.toUpperCase(), prenom, email, password_hash, telephone || null]
    );

    const user = result.rows[0];
    const token = genToken(user);

    res.status(201).json({
      message: 'Compte créé avec succès.',
      token,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        plan: user.plan,
      },
    });

  } catch (err) {
    console.error('Erreur register :', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────
router.post('/login', [
  body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('password').notEmpty().withMessage('Mot de passe obligatoire.'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Chercher l'utilisateur
    const result = await query(
      'SELECT id, nom, prenom, email, password_hash, plan FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'Ce compte utilise la connexion Google. Veuillez vous connecter avec Google.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const token = genToken(user);

    res.json({
      message: 'Connexion réussie.',
      token,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        plan: user.plan,
      },
    });

  } catch (err) {
    console.error('Erreur login :', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// GET /api/auth/google  →  Redirection Google
// ──────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ──────────────────────────────────────
// GET /api/auth/google/callback
// ──────────────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login-error' }),
  (req, res) => {
    const token = genToken(req.user);
    // Rediriger vers le frontend avec le token
    res.redirect(`${process.env.FRONTEND_URL}/dashboard.html?token=${token}`);
  }
);

// ──────────────────────────────────────
// GET /api/auth/me  →  Profil connecté
// ──────────────────────────────────────
const { authMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nom, prenom, email, telephone, plan, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
