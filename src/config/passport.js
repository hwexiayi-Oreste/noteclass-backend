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
      let result = await pool.query(
        'SELECT * FROM nc_users WHERE google_id=$1 OR email=$2',
        [profile.id, email]
      );
      if (result.rows.length === 0) {
        result = await pool.query(
          'INSERT INTO nc_users (nom,prenom,email,google_id,plan) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [
            profile.name.familyName || '',
            profile.name.givenName || '',
            email,
            profile.id,
            'free'
          ]
        );
      } else if (!result.rows[0].google_id) {
        await pool.query('UPDATE nc_users SET google_id=$1 WHERE email=$2', [profile.id, email]);
      }
      return done(null, result.rows[0]);
    } catch (err) {
      return done(err);
    }
  }));
}

module.exports = passport;
