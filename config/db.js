// config/db.js — Connexion à la base de données PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Connexion PostgreSQL établie');
  }
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL :', err.message);
});

module.exports = pool;
