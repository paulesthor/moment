-- Script pour corriger les anciens messages sans statut 'read' défini
-- À exécuter une seule fois dans l'éditeur SQL de Supabase

-- Mettre tous les messages ADMIN comme lus (car ce sont des réponses envoyées)
UPDATE messages 
SET read = true 
WHERE is_admin_reply = true AND read IS NULL;

-- Mettre les vieux messages clients (plus de 24h) comme lus par défaut
UPDATE messages 
SET read = true 
WHERE is_admin_reply = false 
  AND read IS NULL 
  AND created_at < NOW() - INTERVAL '24 hours';

-- Les messages clients récents (moins de 24h) sans statut restent non lus
UPDATE messages 
SET read = false 
WHERE is_admin_reply = false 
  AND read IS NULL 
  AND created_at >= NOW() - INTERVAL '24 hours';
