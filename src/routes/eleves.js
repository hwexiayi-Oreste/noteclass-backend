const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/eleves?classe_id=X
router.get('/', auth, async (req, res) => {
  const { classe_id } = req.query;
  if (!classe_id) return res.status(400).json({ error: 'classe_id requis.' });
  try {
    const result = await pool.query(
      'SELECT e.* FROM nc_eleves e JOIN nc_classes c ON c.id=e.classe_id WHERE e.classe_id=$1 AND c.user_id=$2 ORDER BY e.nom',
      [classe_id, req.user.id]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/eleves
router.post('/', auth, async (req, res) => {
  const { classe_id, nom, prenom } = req.body;
  if (!classe_id || !nom || !prenom) return res.status(400).json({ error: 'Champs obligatoires manquants.' });

  try {
    // Vérifier que la classe appartient à l'utilisateur
    const classe = await pool.query('SELECT id FROM nc_classes WHERE id=$1 AND user_id=$2', [classe_id, req.user.id]);
    if (!classe.rows.length) return res.status(403).json({ error: 'Classe introuvable.' });

    // Limite plan gratuit : 25 élèves par classe
    if (req.user.plan === 'free') {
      const count = await pool.query('SELECT COUNT(*) FROM nc_eleves WHERE classe_id=$1', [classe_id]);
      if (parseInt(count.rows[0].count) >= 25)
        return res.status(403).json({ error: 'Plan Découverte limité à 25 élèves par classe. Passez au Plan Pro.' });
    }

    const result = await pool.query(
      'INSERT INTO nc_eleves (classe_id,nom,prenom) VALUES ($1,$2,$3) RETURNING *',
      [classe_id, nom, prenom]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/eleves/:id
router.put('/:id', auth, async (req, res) => {
  const { nom, prenom } = req.body;
  try {
    const result = await pool.query(
      `UPDATE nc_eleves SET nom=COALESCE($1,nom), prenom=COALESCE($2,prenom)
       WHERE id=$3 AND classe_id IN (SELECT id FROM nc_classes WHERE user_id=$4) RETURNING *`,
      [nom, prenom, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Élève introuvable.' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/eleves/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM nc_eleves WHERE id=$1
       AND classe_id IN (SELECT id FROM nc_classes WHERE user_id=$2) RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Élève introuvable.' });
    res.json({ message: 'Élève supprimé.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
