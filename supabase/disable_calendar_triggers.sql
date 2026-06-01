-- Désactiver TEMPORAIREMENT les triggers Google Calendar
-- Cela permet de créer des RDV normalement en attendant de connecter Google Calendar

DROP TRIGGER IF EXISTS sync_calendar_on_insert ON appointments;
DROP TRIGGER IF EXISTS sync_calendar_on_update ON appointments;
DROP TRIGGER IF EXISTS sync_calendar_on_delete ON appointments;

-- Note: Une fois Google Calendar connecté, ré-exécutez setup_calendar_triggers.sql
-- pour réactiver la synchronisation automatique
