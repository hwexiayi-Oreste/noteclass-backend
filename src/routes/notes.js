const router = require('express').Router();
const pool   = require('../db');
const { auth, requirePro } = require('../middleware/auth');

function appreciation(moy) {
  if (moy === null) return null;
  if (moy >= 16) return { label: 'Très Bien', abrev: 'TB' };
  if (moy >= 14) return { label: 'Bien', abrev: 'B' };
  if (moy >= 12) return { label: 'Assez Bien', abrev: 'AB' };
  if (moy >= 10) return { label: 'Passable', abrev: 'P' };
  if (moy >= 8)  return { label: 'Insuffisant', abrev: 'I' };
  return { label: 'Très Insuffisant', abrev: 'TI' };
}

function calcMoyenne(notes, nbInterros) {
  const interros = [];
  for (let i = 1; i <= nbInterros; i++) {
    const v = notes[`interro${i}`];
    if (v !== null && v !== undefined) interros.push(parseFloat(v));
  }
  const devoirs = [];
  for (let i = 1; i <= 2; i++) {
    const v = notes[`devoir${i}`];
    if (v !== null && v !== undefined) devoirs.push(parseFloat(v));
  }
  if (!interros.length && !devoirs.length) return null;
  const moyInterros = interros.length ? interros.reduce((a,b) => a+b, 0) / interros.length : null;
  const moyDevoirs  = devoirs.length  ? devoirs.reduce((a,b) => a+b, 0)  / devoirs.length  : null;
  if (moyInterros !== null && moyDevoirs !== null)
    return Math.round(((moyInterros + moyDevoirs) / 2) * 100) / 100;
  if (moyInterros !== null) return Math.round(moyInterros * 100) / 100;
  return Math.round(moyDevoirs * 100) / 100;
}

// GET /api/notes?classe_id=X&periode=1&nb_interros=2
router.get('/', auth, async (req, res) => {
  const { classe_id, periode, nb_interros } = req.query;
  if (!classe_id || !periode) return res.status(400).json({ error: 'classe_id et periode requis.' });
  const nbI = parseInt(nb_interros) || 2;

  try {
    // Vérifier accès
    const classe = await pool.query('SELECT * FROM nc_classes WHERE id=$1 AND user_id=$2', [classe_id, req.user.id]);
    if (!classe.rows.length) return res.status(403).json({ error: 'Classe introuvable.' });

    const eleves = await pool.query(
      'SELECT * FROM nc_eleves WHERE classe_id=$1 ORDER BY nom', [classe_id]
    );

    const notes = await pool.query(
      'SELECT * FROM nc_notes WHERE classe_id=$1 AND periode=$2', [classe_id, periode]
    );

    const appre = await pool.query(
      'SELECT * FROM nc_appreciations WHERE classe_id=$1 AND periode=$2', [classe_id, periode]
    );

    const notesMap = {};
    notes.rows.forEach(n => {
      if (!notesMap[n.eleve_id]) notesMap[n.eleve_id] = {};
      notesMap[n.eleve_id][n.type_note] = n.valeur;
    });

    const appMap = {};
    appre.rows.forEach(a => { appMap[a.eleve_id] = a.commentaire; });

    const data = eleves.rows.map(e => {
      const n = notesMap[e.id] || {};
      const moy = calcMoyenne(n, nbI);
      return {
        eleve: e,
        notes: n,
        moyenne: moy,
        appreciation: appreciation(moy),
        commentaire: appMap[e.id] || ''
      };
    });

    const moyennes = data.map(d => d.moyenne).filter(m => m !== null);
    const moyClasse = moyennes.length
      ? Math.round(moyennes.reduce((a,b) => a+b, 0) / moyennes.length * 100) / 100
      : null;

    res.json({ classe: classe.rows[0], eleves: data, moyenne_classe: moyClasse });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/notes/save
router.post('/save', auth, async (req, res) => {
  const { classe_id, periode, notes, appreciations } = req.body;
  if (!classe_id || !periode) return res.status(400).json({ error: 'classe_id et periode requis.' });

  try {
    const classe = await pool.query('SELECT id FROM nc_classes WHERE id=$1 AND user_id=$2', [classe_id, req.user.id]);
    if (!classe.rows.length) return res.status(403).json({ error: 'Classe introuvable.' });

    // Sauvegarder les notes (UPSERT)
    for (const [eleve_id, noteData] of Object.entries(notes || {})) {
      for (const [type_note, valeur] of Object.entries(noteData)) {
        if (valeur === '' || valeur === null || valeur === undefined) continue;
        await pool.query(
          `INSERT INTO nc_notes (eleve_id, classe_id, periode, type_note, valeur)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (eleve_id, classe_id, periode, type_note)
           DO UPDATE SET valeur=$5, updated_at=NOW()`,
          [eleve_id, classe_id, periode, type_note, valeur]
        );
      }
    }

    // Sauvegarder les appréciations
    for (const [eleve_id, commentaire] of Object.entries(appreciations || {})) {
      await pool.query(
        `INSERT INTO nc_appreciations (eleve_id, classe_id, periode, commentaire)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (eleve_id, classe_id, periode)
         DO UPDATE SET commentaire=$4, updated_at=NOW()`,
        [eleve_id, classe_id, periode, commentaire]
      );
    }

    res.json({ message: 'Notes enregistrées.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/notes/releve/:classe_id/:periode  — Plan Pro uniquement
router.get('/releve/:classe_id/:periode', auth, requirePro, async (req, res) => {
  const { classe_id, periode } = req.params;
  try {
    const classe = await pool.query('SELECT * FROM nc_classes WHERE id=$1 AND user_id=$2', [classe_id, req.user.id]);
    if (!classe.rows.length) return res.status(403).json({ error: 'Classe introuvable.' });

    const eleves = await pool.query('SELECT * FROM nc_eleves WHERE classe_id=$1 ORDER BY nom', [classe_id]);
    const notes  = await pool.query('SELECT * FROM nc_notes WHERE classe_id=$1 AND periode=$2', [classe_id, periode]);
    const appre  = await pool.query('SELECT * FROM nc_appreciations WHERE classe_id=$1 AND periode=$2', [classe_id, periode]);

    res.json({ classe: classe.rows[0], eleves: eleves.rows, notes: notes.rows, appreciations: appre.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
