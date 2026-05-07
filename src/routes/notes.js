// src/routes/notes.js
const express = require('express');
const { query } = require('../db');
const { authMiddleware, requirePro } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ══════════════════════════════════════
//   CALCUL DE LA MOYENNE (côté serveur)
// ══════════════════════════════════════
function calculerMoyenne(notes, nbInterros) {
  const vals = {};
  notes.forEach(n => { vals[n.type_note] = parseFloat(n.valeur); });

  // Moyennes interros
  const interros = [];
  for (let i = 1; i <= nbInterros; i++) {
    if (vals[`interro${i}`] !== undefined) interros.push(vals[`interro${i}`]);
  }
  const moyI = interros.length > 0
    ? interros.reduce((a, b) => a + b, 0) / interros.length
    : null;

  // Moyennes devoirs
  const devoirs = [];
  if (vals['devoir1'] !== undefined) devoirs.push(vals['devoir1']);
  if (vals['devoir2'] !== undefined) devoirs.push(vals['devoir2']);
  const moyD = devoirs.length > 0
    ? devoirs.reduce((a, b) => a + b, 0) / devoirs.length
    : null;

  // Moyenne matière
  if (moyI === null && moyD === null) return null;
  let total = 0, poids = 0;
  if (moyI !== null) { total += moyI; poids++; }
  if (moyD !== null) { total += moyD; poids++; }
  return Math.round((total / poids) * 100) / 100;
}

function getAppreciation(moy) {
  if (moy === null) return null;
  if (moy >= 16) return 'Très Bien';
  if (moy >= 14) return 'Bien';
  if (moy >= 12) return 'Assez Bien';
  if (moy >= 10) return 'Passable';
  if (moy >= 8)  return 'Insuffisant';
  return 'Très Insuffisant';
}

// ──────────────────────────────────────
// GET /api/notes?classe_id=X&periode=1&nb_interros=2
// Retourne toutes les notes + moyennes calculées
// ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { classe_id, periode, nb_interros } = req.query;
    if (!classe_id || !periode) {
      return res.status(400).json({ error: 'classe_id et periode sont requis.' });
    }

    // Vérifier accès à la classe
    const classeCheck = await query(
      'SELECT id, coefficient FROM classes WHERE id=$1 AND user_id=$2',
      [classe_id, req.user.id]
    );
    if (classeCheck.rows.length === 0)
      return res.status(403).json({ error: 'Accès non autorisé.' });

    const nbInterros = parseInt(nb_interros) || 1;

    // Récupérer tous les élèves de la classe
    const elevesResult = await query(
      'SELECT id, nom, prenom FROM eleves WHERE classe_id=$1 ORDER BY nom, prenom',
      [classe_id]
    );

    // Récupérer toutes les notes de la période
    const notesResult = await query(
      `SELECT eleve_id, type_note, valeur
       FROM notes
       WHERE classe_id=$1 AND periode=$2`,
      [classe_id, periode]
    );

    // Récupérer les appréciations
    const apprecResult = await query(
      `SELECT eleve_id, commentaire
       FROM appreciations
       WHERE classe_id=$1 AND periode=$2`,
      [classe_id, periode]
    );

    // Organiser les notes par élève
    const notesByEleve = {};
    notesResult.rows.forEach(n => {
      if (!notesByEleve[n.eleve_id]) notesByEleve[n.eleve_id] = [];
      notesByEleve[n.eleve_id].push(n);
    });

    const apprecByEleve = {};
    apprecResult.rows.forEach(a => {
      apprecByEleve[a.eleve_id] = a.commentaire;
    });

    // Construire la réponse avec moyennes calculées
    const data = elevesResult.rows.map(eleve => {
      const notes = notesByEleve[eleve.id] || [];
      const moy   = calculerMoyenne(notes, nbInterros);
      const appr  = getAppreciation(moy);

      // Transformer notes en objet key-value
      const notesObj = {};
      notes.forEach(n => { notesObj[n.type_note] = n.valeur; });

      return {
        eleve_id:    eleve.id,
        nom:         eleve.nom,
        prenom:      eleve.prenom,
        notes:       notesObj,
        moyenne:     moy,
        appreciation: appr,
        commentaire: apprecByEleve[eleve.id] || '',
      };
    });

    // Moyenne de classe
    const moyennes = data.map(d => d.moyenne).filter(m => m !== null);
    const moyClasse = moyennes.length > 0
      ? Math.round(moyennes.reduce((a, b) => a + b, 0) / moyennes.length * 100) / 100
      : null;

    res.json({
      classe_id: parseInt(classe_id),
      periode:   parseInt(periode),
      coefficient: classeCheck.rows[0].coefficient,
      eleves:    data,
      moyenne_classe: moyClasse,
      appreciation_classe: getAppreciation(moyClasse),
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ──────────────────────────────────────
// POST /api/notes/save
// Sauvegarder les notes d'une classe/période
// Body: { classe_id, periode, nb_interros, eleves: [{eleve_id, notes:{}, commentaire}] }
// ──────────────────────────────────────
router.post('/save', async (req, res) => {
  const client = await require('../db').pool.connect();
  try {
    const { classe_id, periode, eleves } = req.body;

    if (!classe_id || !periode || !eleves) {
      return res.status(400).json({ error: 'Données incomplètes.' });
    }

    // Vérifier accès
    const classeCheck = await client.query(
      'SELECT id FROM classes WHERE id=$1 AND user_id=$2',
      [classe_id, req.user.id]
    );
    if (classeCheck.rows.length === 0)
      return res.status(403).json({ error: 'Accès non autorisé.' });

    await client.query('BEGIN');

    for (const eleve of eleves) {
      const { eleve_id, notes, commentaire } = eleve;

      // Sauvegarder chaque note avec UPSERT
      for (const [type_note, valeur] of Object.entries(notes)) {
        if (valeur === '' || valeur === null || valeur === undefined) {
          // Supprimer la note si vide
          await client.query(
            'DELETE FROM notes WHERE eleve_id=$1 AND classe_id=$2 AND periode=$3 AND type_note=$4',
            [eleve_id, classe_id, periode, type_note]
          );
        } else {
          const val = parseFloat(valeur);
          if (!isNaN(val) && val >= 0 && val <= 20) {
            await client.query(
              `INSERT INTO notes (eleve_id, classe_id, periode, type_note, valeur)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (eleve_id, classe_id, periode, type_note)
               DO UPDATE SET valeur=$5, updated_at=NOW()`,
              [eleve_id, classe_id, periode, type_note, val]
            );
          }
        }
      }

      // Sauvegarder le commentaire
      if (commentaire !== undefined) {
        await client.query(
          `INSERT INTO appreciations (eleve_id, classe_id, periode, commentaire)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (eleve_id, classe_id, periode)
           DO UPDATE SET commentaire=$4, updated_at=NOW()`,
          [eleve_id, classe_id, periode, commentaire || '']
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Notes enregistrées avec succès.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────
// GET /api/notes/releve/:classe_id/:periode
// Relevé complet pour export PDF (Plan Pro)
// ──────────────────────────────────────
router.get('/releve/:classe_id/:periode', requirePro, async (req, res) => {
  try {
    const { classe_id, periode } = req.params;

    const classeResult = await query(
      `SELECT c.*, e.nom AS ecole_nom, e.type AS ecole_type
       FROM classes c JOIN ecoles e ON e.id = c.ecole_id
       WHERE c.id=$1 AND c.user_id=$2`,
      [classe_id, req.user.id]
    );
    if (classeResult.rows.length === 0)
      return res.status(404).json({ error: 'Classe introuvable.' });

    const classe = classeResult.rows[0];

    const elevesResult = await query(
      'SELECT id, nom, prenom FROM eleves WHERE classe_id=$1 ORDER BY nom, prenom',
      [classe_id]
    );

    const notesResult = await query(
      'SELECT eleve_id, type_note, valeur FROM notes WHERE classe_id=$1 AND periode=$2',
      [classe_id, periode]
    );

    const apprecResult = await query(
      'SELECT eleve_id, commentaire FROM appreciations WHERE classe_id=$1 AND periode=$2',
      [classe_id, periode]
    );

    const notesByEleve = {};
    notesResult.rows.forEach(n => {
      if (!notesByEleve[n.eleve_id]) notesByEleve[n.eleve_id] = [];
      notesByEleve[n.eleve_id].push(n);
    });

    const apprecByEleve = {};
    apprecResult.rows.forEach(a => { apprecByEleve[a.eleve_id] = a.commentaire; });

    const nbInterros = parseInt(req.query.nb_interros) || 1;

    const eleves = elevesResult.rows.map((el, idx) => {
      const notes  = notesByEleve[el.id] || [];
      const notesObj = {};
      notes.forEach(n => { notesObj[n.type_note] = parseFloat(n.valeur); });
      const moy  = calculerMoyenne(notes, nbInterros);
      const appr = getAppreciation(moy);
      return {
        rang:        idx + 1,
        nom:         el.nom,
        prenom:      el.prenom,
        notes:       notesObj,
        moyenne:     moy,
        appreciation: appr,
        commentaire: apprecByEleve[el.id] || '',
      };
    });

    const moyennes = eleves.map(e => e.moyenne).filter(m => m !== null);
    const moyClasse = moyennes.length > 0
      ? Math.round(moyennes.reduce((a,b) => a+b, 0) / moyennes.length * 100) / 100
      : null;

    res.json({
      classe,
      periode: parseInt(periode),
      professeur: `${req.user.prenom} ${req.user.nom}`,
      eleves,
      moyenne_classe:      moyClasse,
      appreciation_classe: getAppreciation(moyClasse),
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
