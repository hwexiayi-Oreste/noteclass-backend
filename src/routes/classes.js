const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/classes?ecole_id=X
router.get('/', auth, async (req, res) => {
  try {
    const { ecole_id } = req.query;
    let query = 'SELECT * FROM nc_classes WHERE user_id=$1';
    const params = [req.user.id];
    if (ecole_id) { query += ' AND ecole_id=$2'; params.push(ecole_id); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/classes
router.post('/', auth, async (req, res) => {
  const { ecole_id, nom, matiere, coefficient, type_periode, annee_scolaire } = req.body;
  if (!ecole_id || !nom || !matiere || !type_periode)
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });

  // Vérifier que l'école appartient à l'utilisateur
  try {
    const ecole = await pool.query('SELECT id FROM nc_ecoles WHERE id=$1 AND user_id=$2', [ecole_id, req.user.id]);
    if (!ecole.rows.length) return res.status(403).json({ error: 'École introuvable.' });

    const result = await pool.query(
      'INSERT INTO nc_classes (ecole_id,user_id,nom,matiere,coefficient,type_periode,annee_scolaire) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [ecole_id, req.user.id, nom, matiere, coefficient || 1, type_periode, annee_scolaire || '2024-2025']
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/classes/:id
router.put('/:id', auth, async (req, res) => {
  const { nom, matiere, coefficient, type_periode, annee_scolaire } = req.body;
  try {
    const result = await pool.query(
      `UPDATE nc_classes SET
        nom=COALESCE($1,nom),
        matiere=COALESCE($2,matiere),
        coefficient=COALESCE($3,coefficient),
        type_periode=COALESCE($4,type_periode),
        annee_scolaire=COALESCE($5,annee_scolaire)
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [nom, matiere, coefficient, type_periode, annee_scolaire, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Classe introuvable.' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/classes/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM nc_classes WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Classe introuvable.' });
    res.json({ message: 'Classe supprimée.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
