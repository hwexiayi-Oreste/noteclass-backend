// src/config/passport.js
const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query }      = require('../db');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email     = profile.emails[0].value;
    const google_id = profile.id;
    const prenom    = profile.name.givenName  || '';
    const nom       = (profile.name.familyName || '').toUpperCase();

    // Vérifier si l'utilisateur existe déjà
    let result = await query(
      'SELECT * FROM users WHERE google_id=$1 OR email=$2',
      [google_id, email]
    );

    if (result.rows.length > 0) {
      // Mettre à jour google_id si connexion email existante
      const user = result.rows[0];
      if (!user.google_id) {
        await query('UPDATE users SET google_id=$1 WHERE id=$2', [google_id, user.id]);
      }
      return done(null, user);
    }

    // Créer un nouveau compte
    result = await query(
      `INSERT INTO users (nom, prenom, email, google_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nom, prenom, email, google_id]
    );

    return done(null, result.rows[0]);

  } catch (err) {
    return done(err, null);
  }
}));

module.exports = passport;
