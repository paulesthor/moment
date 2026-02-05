-- Database Trigger pour appeler l'Edge Function automatiquement
-- Ce script crée les triggers qui déclenchent la synchronisation Google Calendar

-- Fonction qui appelle l'Edge Function
CREATE OR REPLACE FUNCTION trigger_google_calendar_sync()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
BEGIN
  -- Construire le payload selon le type d'opération
  IF (TG_OP = 'DELETE') THEN
    payload := jsonb_build_object(
      'type', TG_OP,
      'old_record', row_to_json(OLD)
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    payload := jsonb_build_object(
      'type', TG_OP,
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );
  ELSE
    payload := jsonb_build_object(
      'type', TG_OP,
      'record', row_to_json(NEW)
    );
  END IF;

  -- Appeler l'Edge Function de manière asynchrone
  PERFORM net.http_post(
    url := 'https://uskjzczcuawhmrlwszpc.supabase.co/functions/v1/sync-google-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.claim.sub', true)
    ),
    body := payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer les triggers pour INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS sync_calendar_on_insert ON appointments;
CREATE TRIGGER sync_calendar_on_insert
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_google_calendar_sync();

DROP TRIGGER IF EXISTS sync_calendar_on_update ON appointments;
CREATE TRIGGER sync_calendar_on_update
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION trigger_google_calendar_sync();

DROP TRIGGER IF EXISTS sync_calendar_on_delete ON appointments;
CREATE TRIGGER sync_calendar_on_delete
  AFTER DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_google_calendar_sync();

-- Note: Cette fonction utilise l'extension pg_net qui doit être activée
-- Si vous avez une erreur, exécutez d'abord: CREATE EXTENSION IF NOT EXISTS pg_net;
