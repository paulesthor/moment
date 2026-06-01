-- SUPPRESSION COMPLÈTE DE TOUS LES UTILISATEURS
-- ⚠️ ATTENTION : Ceci va TOUT supprimer

-- Étape 1: Supprimer les dépendances (ordre important pour les contraintes FK)
DELETE FROM appointments;
DELETE FROM messages;
DELETE FROM google_calendar_tokens;

-- Étape 2: Supprimer les profils
DELETE FROM profiles;

-- Étape 3: Supprimer les utilisateurs auth
-- ⚠️ Si cette commande échoue avec "permission denied", suivez les instructions ci-dessous
DELETE FROM auth.users;

-- SI L'ÉTAPE 3 ÉCHOUE:
-- Allez manuellement dans Dashboard Supabase > Authentication > Users
-- Cochez la case en haut pour sélectionner tous les utilisateurs
-- Cliquez sur le bouton "Delete" qui apparaît
-- Confirmez la suppression

-- VÉRIFICATION:
SELECT COUNT(*) as "Profils restants" FROM profiles;
SELECT COUNT(*) as "Users restants" FROM auth.users;
