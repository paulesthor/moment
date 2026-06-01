-- RESET COMPLET : Supprimer tous les utilisateurs
-- ⚠️ ATTENTION : Ceci va supprimer TOUS les comptes utilisateurs

-- Étape 1: Supprimer tous les rendez-vous (ils dépendent de profiles)
DELETE FROM appointments;

-- Étape 2: Supprimer tous les messages (ils dépendent de profiles)
DELETE FROM messages;

-- Étape 3: Supprimer tous les profils
DELETE FROM profiles;

-- Étape 4: Les utilisateurs auth.users seront supprimés via le Dashboard
-- Car on ne peut pas les supprimer directement via SQL pour des raisons de sécurité

-- APRÈS avoir exécuté ce script:
-- 1. Allez dans Dashboard Supabase > Authentication > Users
-- 2. Supprimez TOUS les utilisateurs manuellement (bouton Delete)
-- 3. Reconnectez-vous avec Google via login.html
-- 4. Exécutez le script promote_google_to_admin.sql pour devenir admin
