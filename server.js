// server.js — Point d'entrée NoteClass Backend
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const passport = require('./src/config/passport');

const app = express();

// MIDDLEWARES GLOBAUX
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// AUTO-CRÉATION DES TABLES AU DÉMARRAGE
async function initDatabase() {
  try {
    const pool = require('./src/db');
    const sql = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ Base de données initialisée');
  } catch (err) {
    console.log('ℹ️ Base déjà initialisée ou erreur:', err.message);
  }
}
initDatabase();

// ROUTES
app.use('/api/auth',    require('./src/routes/auth'));
app.use('/api/ecoles',  require('./src/routes/ecoles'));
app.use('/api/classes', require('./src/routes/classes'));
app.use('/api/eleves',  require('./src/routes/eleves'));
app.use('/api/notes',   require('./src/routes/notes'));

// SANTÉ
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'NoteClass API', version: '1.0.0' });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }));

// Erreurs
app.use((err, req, res, next) => {
  console.error('Erreur :', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 NoteClass API démarrée sur le port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
