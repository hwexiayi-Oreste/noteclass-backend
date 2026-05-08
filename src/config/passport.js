const passport = require('passport');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  const pool = require('../db');

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://noteclass-backend.onrender.com/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const nom = profile.name.familyName || profile.displayName.split(' ').slice(-1)[0] || 'Utilisateur';
      const prenom = profile.name.givenName || profile.displayName.split(' ')[0] || '';

      let result = await pool.query(
        'SELECT * FROM nc_users WHERE google_id=$1 OR email=$2',
        [profile.id, email]
      );
      if (result.rows.length === 0) {
        result = await pool.query(
          'INSERT INTO nc_users (nom,prenom,email,google_id,plan) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [nom, prenom, email, profile.id, 'free']
        );
      } else {
        // Mettre à jour google_id et nom si manquants
        await pool.query(
          'UPDATE nc_users SET google_id=COALESCE(google_id,$1), nom=CASE WHEN nom=\'\' THEN $2 ELSE nom END, prenom=CASE WHEN prenom=\'\' THEN $3 ELSE prenom END WHERE email=$4',
          [profile.id, nom, prenom, email]
        );
        result = await pool.query('SELECT * FROM nc_users WHERE email=$1', [email]);
      }
      return done(null, result.rows[0]);
    } catch (err) {
      return done(err);
    }
  }));
}

module.exports = passport;
