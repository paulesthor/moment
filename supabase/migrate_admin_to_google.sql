-- Migration Compte Admin vers Google OAuth
-- Ce script identifie et promeut le compte Google en admin

-- ÉTAPE 1: Identifier vos comptes (exécutez ça d'abord)
SELECT 
    id,
    email,
    raw_app_meta_data->>'provider' as provider,
    created_at
FROM auth.users
WHERE email ILIKE '%votre-email%'  -- Remplacez par votre adresse email
ORDER BY created_at;

-- ÉTAPE 2: Promouvoir le compte Google en admin
-- Copiez l'ID du compte 'google' ci-dessus et utilisez-le ici
UPDATE profiles
SET role = 'admin'
WHERE id = 'COLLEZ_ICI_ID_DU_COMPTE_GOOGLE';

-- ÉTAPE 3: Vérifier que ça a marché
SELECT id, email, role, created_at
FROM profiles
WHERE role = 'admin';

-- ÉTAPE 4: Supprimer l'ancien compte email/password
-- ⚠️ À faire MANUELLEMENT dans le Dashboard Supabase:
-- Authentication > Users > Trouver le compte email/password > Delete User
