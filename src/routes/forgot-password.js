const router = require('express').Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  try {
    const result = await pool.query('SELECT id, nom, prenom FROM nc_users WHERE email=$1', [email]);
    if (!result.rows.length) {
      // Ne pas révéler si l'email existe
      return res.json({ message: 'Si cet email existe, un lien a été envoyé.' });
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 heure

    // Sauvegarder le token
    await pool.query(
      `INSERT INTO nc_password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token=$2, expires_at=$3`,
      [user.id, token, expiry]
    );

    const resetUrl = `https://hwexiayi-oreste.github.io/noteclass-frontend/noteclass-reset.html?token=${token}`;

    await resend.emails.send({
      from: 'NoteClass <onboarding@resend.dev>',
      to: email,
      subject: 'Réinitialisation de votre mot de passe NoteClass',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#f5f6fa;border-radius:12px">
          <h2 style="color:#1A237E;font-family:serif">NoteClass</h2>
          <p>Bonjour <strong>${user.prenom} ${user.nom}</strong>,</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
          <a href="${resetUrl}" style="display:inline-block;background:#1A237E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
            Réinitialiser mon mot de passe
          </a>
          <p style="color:#666;font-size:13px">Ce lien expire dans <strong>1 heure</strong>.</p>
          <p style="color:#666;font-size:13px">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
          <p style="color:#aaa;font-size:11px">NoteClass — Gestion des notes scolaires</p>
        </div>
      `
    });

    res.json({ message: 'Si cet email existe, un lien a été envoyé.' });
  } catch (e) {
    console.error('Forgot password error:', e.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis.' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum).' });

  try {
    const result = await pool.query(
      'SELECT * FROM nc_password_resets WHERE token=$1 AND expires_at > NOW()',
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Lien invalide ou expiré.' });

    const { user_id } = result.rows[0];
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE nc_users SET password_hash=$1 WHERE id=$2', [hash, user_id]);
    await pool.query('DELETE FROM nc_password_resets WHERE user_id=$1', [user_id]);

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (e) {
    console.error('Reset password error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation.' });
  }
});

module.exports = router;
