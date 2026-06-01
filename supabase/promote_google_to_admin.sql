-- Promouvoir le compte Google en admin
-- Exécutez ce script APRÈS vous être connecté avec Google

-- Étape 1: Vérifier quel compte existe
SELECT id, email, role, created_at
FROM profiles
ORDER BY created_at DESC;

-- Étape 2: Promouvoir en admin
-- Remplacez 'VOTRE_EMAIL@gmail.com' par votre vraie adresse
UPDATE profiles
SET role = 'admin'
WHERE email = 'VOTRE_EMAIL@gmail.com';

-- Étape 3: Vérification
SELECT id, email, role
FROM profiles
WHERE role = 'admin';
