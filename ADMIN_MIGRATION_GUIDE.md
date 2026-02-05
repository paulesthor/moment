# Guide de Migration : Admin Email/Password

## 🎯 Objectif
Migrer de Google OAuth vers Email/Password pour l'admin, tout en conservant la possibilité de synchroniser Google Calendar.

---

## 📋 Étape 1 : Suppression du Compte Google

1. Allez sur **Supabase Dashboard** (supabase.com)
2. Projet → **Authentication** → **Users**
3. Trouvez l'utilisateur avec votre email Google
4. Cliquez sur les **3 points** (⋮) → **Delete user**
5. Confirmez la suppression

---

## 📋 Étape 2 : Création Compte Email/Password

1. Allez sur `http://localhost:8000/register.html`
2. Remplissez le formulaire :
   - **Nom** : Votre nom
   - **Email** : L'adresse email que vous voulez utiliser
   - **Mot de passe** : Un mot de passe sécurisé
3. Cliquez sur **"S'inscrire"**
4. Vous serez automatiquement connecté

---

## 📋 Étape 3 : Promotion en Admin

1. Retournez sur **Supabase Dashboard** → **SQL Editor**
2. Exécutez cette requête (en remplaçant l'email) :

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'VOTRE_EMAIL@example.com';
```

3. Vérifiez avec :

```sql
SELECT id, email, role FROM profiles WHERE role = 'admin';
```

---

## 📋 Étape 4 : Test du Dashboard

1. Allez sur `http://localhost:8000/login.html`
2. Connectez-vous avec **votre email + mot de passe**
3. Allez sur `http://localhost:8000/admin-dashboard.html`
4. **Le dashboard devrait charger normalement** ✅

---

## 📋 Étape 5 : Google Calendar Sync (Plus tard)

Une fois le dashboard fonctionnel :
1. Cliquez sur **"Connect Google Calendar"** dans le dashboard
2. Autorisez l'accès à votre calendrier Google
3. Les rendez-vous se synchroniseront automatiquement

**Note :** C'est un OAuth séparé, complètement indépendant de votre connexion admin.

---

## ✅ Résultat Final

- **Connexion admin** : Email/Password ✅
- **Dashboard** : Fonctionne ✅
- **Google Calendar** : Peut être connecté après ✅
- **Clients** : Peuvent toujours utiliser Google OAuth pour se connecter ✅
