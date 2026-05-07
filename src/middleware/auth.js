// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const authMiddleware = async (req, res, next) => {
  try {
    // Récupérer le token dans le header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant. Veuillez vous connecter.' });
    }

    const token = authHeader.split(' ')[1];

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que l'utilisateur existe toujours
    const result = await query(
      'SELECT id, nom, prenom, email, plan FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }

    // Attacher l'utilisateur à la requête
    req.user = result.rows[0];
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }
    return res.status(401).json({ error: 'Token invalide.' });
  }
};

// Middleware pour vérifier le plan Pro
const requirePro = (req, res, next) => {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({
      error: 'Fonctionnalité réservée au plan Pro.',
      upgrade: true,
    });
  }
  next();
};

module.exports = { authMiddleware, requirePro };
