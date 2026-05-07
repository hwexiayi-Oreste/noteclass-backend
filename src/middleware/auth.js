const jwt  = require('jsonwebtoken');
const pool = require('../db');

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token manquant.' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result  = await pool.query('SELECT id,email,plan FROM nc_users WHERE id=$1', [decoded.id]);
    if (!result.rows.length) return res.status(401).json({ error: 'Utilisateur introuvable.' });
    req.user = result.rows[0];
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
};

const requirePro = (req, res, next) => {
  if (req.user.plan !== 'pro')
    return res.status(403).json({ error: 'Cette fonctionnalité nécessite le Plan Pro.' });
  next();
};

module.exports = { auth, requirePro };
