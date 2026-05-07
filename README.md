# 🇧🇯 NoteClass — Backend API

Fiche de notes numérique pour les professeurs du Bénin.  
Stack : **Node.js + Express + PostgreSQL**  
Hébergement : **Render** (gratuit pour démarrer)

---

## 📁 Structure du projet

```
noteclass-backend/
├── server.js              ← Point d'entrée
├── package.json
├── .env.example           ← Copier en .env
├── config/
│   └── db.js              ← Connexion PostgreSQL
├── middlewares/
│   ├── auth.js            ← Vérification JWT
│   └── freemium.js        ← Limites plan gratuit
├── routes/
│   ├── auth.js            ← Inscription / Connexion / Google
│   ├── schools.js         ← Gestion des écoles
│   ├── classes.js         ← Gestion des classes
│   ├── students.js        ← Gestion des élèves
│   └── grades.js          ← Notes et moyennes
└── sql/
    └── schema.sql         ← Créer les tables
```

---

## 🚀 Déploiement sur Render (étape par étape)

### Étape 1 — Créer le dépôt GitHub

1. Aller sur [github.com](https://github.com) → **New repository**
2. Nom : `noteclass-backend`
3. Initialiser avec un README
4. Uploader tous les fichiers du projet

### Étape 2 — Créer la base de données PostgreSQL sur Render

1. Aller sur [render.com](https://render.com) → **New** → **PostgreSQL**
2. Nom : `noteclass-db`
3. Plan : **Free**
4. Cliquer **Create Database**
5. Copier l'**Internal Database URL** (elle sera utilisée dans `.env`)

### Étape 3 — Créer le service Web sur Render

1. **New** → **Web Service**
2. Connecter votre dépôt GitHub `noteclass-backend`
3. Paramètres :
   - **Name** : `noteclass-api`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Plan** : Free

### Étape 4 — Configurer les variables d'environnement sur Render

Dans **Environment** → ajouter :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | L'URL PostgreSQL copiée à l'étape 2 |
| `JWT_SECRET` | Une longue chaîne aléatoire (ex: `noteclass2024_secret_key_benin`) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `GOOGLE_CLIENT_ID` | Voir étape 5 |
| `GOOGLE_CLIENT_SECRET` | Voir étape 5 |
| `GOOGLE_CALLBACK_URL` | `https://noteclass-api.onrender.com/api/auth/google/callback` |
| `FRONTEND_URL` | URL de votre frontend |

### Étape 5 — Configurer Google OAuth

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Créer un nouveau projet : **NoteClass**
3. **APIs & Services** → **OAuth consent screen** → External → Remplir
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**
5. Type : **Web application**
6. **Authorized redirect URIs** : `https://noteclass-api.onrender.com/api/auth/google/callback`
7. Copier le **Client ID** et **Client Secret** dans les variables Render

### Étape 6 — Initialiser la base de données

Sur Render, dans votre base PostgreSQL → **Shell** ou via un client :

```sql
-- Copier-coller le contenu de sql/schema.sql
```

---

## 📡 Routes API disponibles

### Authentification
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/inscription` | Créer un compte |
| POST | `/api/auth/connexion` | Se connecter |
| GET | `/api/auth/google` | Connexion Google |
| GET | `/api/auth/me` | Profil connecté |

### Écoles
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/schools` | Liste des écoles |
| POST | `/api/schools` | Créer une école |
| PUT | `/api/schools/:id` | Modifier |
| DELETE | `/api/schools/:id` | Supprimer |

### Classes
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/classes` | Toutes mes classes |
| GET | `/api/classes/school/:id` | Classes d'une école |
| GET | `/api/classes/:id` | Détail d'une classe |
| POST | `/api/classes` | Créer une classe |
| PUT | `/api/classes/:id` | Modifier |
| DELETE | `/api/classes/:id` | Supprimer |

### Élèves
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/students/class/:class_id` | Élèves d'une classe |
| POST | `/api/students` | Ajouter un élève |
| PUT | `/api/students/:id` | Modifier |
| DELETE | `/api/students/:id` | Supprimer |

### Notes
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/grades/class/:id/periode/:n` | Notes d'une classe |
| POST | `/api/grades` | Sauvegarder une note |
| POST | `/api/grades/batch` | Sauvegarder toute une classe |

---

## 🔐 Limites Freemium

| Fonctionnalité | Plan Gratuit | Plan Pro |
|---|---|---|
| Écoles | 1 | Illimité |
| Élèves/classe | 10 max | Illimité |
| Export PDF | ❌ | ✅ |
| Historique | ❌ | ✅ |

---

## 💡 Tester en local

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et remplir le fichier .env
cp .env.example .env

# 3. Démarrer en mode développement
npm run dev
```

---

*Conçu par **Kol@ Agency** · Akpakpa, Suru Léré, Bénin · 2025*
