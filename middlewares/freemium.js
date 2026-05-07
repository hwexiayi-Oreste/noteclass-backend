// middlewares/freemium.js — Limites du plan Découverte (gratuit)
const pool = require('../config/db');

const LIMITS = {
  free: {
    max_schools:           1,
    max_students_per_class: 10,
    can_export_pdf:        false,
    can_see_history:       false,
  },
  pro: {
    max_schools:           Infinity,
    max_students_per_class: Infinity,
    can_export_pdf:        true,
    can_see_history:       true,
  },
};

// Vérifie la limite d'écoles (plan gratuit = 1 école)
const checkSchoolLimit = async (req, res, next) => {
  if (req.user.plan === 'pro') return next();
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM schools WHERE user_id = $1',
      [req.user.id]
    );
    const count = parseInt(result.rows[0].count);
    if (count >= LIMITS.free.max_schools) {
      return res.status(403).json({
        message: `Plan Découverte : vous ne pouvez avoir qu'une seule école. Passez au plan Pro pour en ajouter davantage.`,
        upgrade_required: true,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// Vérifie la limite d'élèves par classe (plan gratuit = 10 max)
const checkStudentLimit = async (req, res, next) => {
  if (req.user.plan === 'pro') return next();
  try {
    const { class_id } = req.body;
    if (!class_id) return next();

    const result = await pool.query(
      'SELECT COUNT(*) FROM students WHERE class_id = $1 AND user_id = $2',
      [class_id, req.user.id]
    );
    const count = parseInt(result.rows[0].count);
    if (count >= LIMITS.free.max_students_per_class) {
      return res.status(403).json({
        message: `Plan Découverte : maximum ${LIMITS.free.max_students_per_class} élèves par classe. Passez au plan Pro pour un nombre illimité.`,
        upgrade_required: true,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// Vérifie l'accès à l'export PDF (plan Pro uniquement)
const checkPdfAccess = (req, res, next) => {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({
      message: 'L\'export PDF est disponible uniquement avec le plan Pro.',
      upgrade_required: true,
    });
  }
  next();
};

// Vérifie l'accès à l'historique (plan Pro uniquement)
const checkHistoryAccess = (req, res, next) => {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({
      message: 'L\'historique des années scolaires est disponible uniquement avec le plan Pro.',
      upgrade_required: true,
    });
  }
  next();
};

module.exports = {
  checkSchoolLimit,
  checkStudentLimit,
  checkPdfAccess,
  checkHistoryAccess,
  LIMITS,
};
