# Guide de Déploiement : Synchronisation Google Calendar

## Prérequis

1. ✅ Google Cloud Console configuré (OAuth déjà fait)
2. ✅ Supabase CLI installé : https://supabase.com/docs/guides/cli

---

## Étape 1 : Activer Google Calendar API

1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** → **Library**
3. Chercher "Google Calendar API"
4. Cliquer **Enable**

---

## Étape 2 : Ajouter le Scope Calendar

1. **APIs & Services** → **OAuth consent screen**
2. Cliquer **Edit App**
3. Dans "Scopes", cliquer **Add or Remove Scopes**
4. Chercher et ajouter :
   - `https://www.googleapis.com/auth/calendar.events`
5. **Save and Continue**

---

## Étape 3 : Créer les Tables dans Supabase

1. Aller sur **Supabase Dashboard** → **SQL Editor**
2. Copier tout le contenu de `supabase/setup_google_calendar.sql`
3. Cliquer **Run**

---

## Étape 4 : Déployer l'Edge Function

Ouvrir un terminal PowerShell dans le dossier du projet :

```powershell
# Se connecter à Supabase
npx supabase login

# Lier votre projet
npx supabase link --project-ref uskjzczcuawhmrlwszpc

# Déployer la fonction
npx supabase functions deploy sync-google-calendar

# Configurer les secrets (remplacer par vos vraies valeurs)
npx supabase secrets set GOOGLE_CLIENT_ID="1076172533691-l8qa0389r79968uc644crn6ejvfeqib8.apps.googleusercontent.com"
npx supabase secrets set GOOGLE_CLIENT_SECRET="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"
```

---

## Étape 5 : Créer le Trigger Database

Dans **Supabase SQL Editor**, exécuter :

```sql
-- Créer une fonction qui appelle l'Edge Function
CREATE OR REPLACE FUNCTION trigger_google_calendar_sync()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Appeler l'Edge Function avec les données
  PERFORM net.http_post(
    url := 'https://uskjzczcuawhmrlwszpc.supabase.co/functions/v1/sync-google-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer les triggers
DROP TRIGGER IF EXISTS sync_calendar_on_insert ON appointments;
CREATE TRIGGER sync_calendar_on_insert
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_google_calendar_sync();

DROP TRIGGER IF EXISTS sync_calendar_on_update ON appointments;
CREATE TRIGGER sync_calendar_on_update
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_google_calendar_sync();

DROP TRIGGER IF EXISTS sync_calendar_on_delete ON appointments;
CREATE TRIGGER sync_calendar_on_delete
  AFTER DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_google_calendar_sync();
```

---

## Étape 6 : Tester

1. Se connecter en admin
2. Connecter Google Calendar (nouveau bouton dans l'interface)
3. Créer un rendez-vous test
4. Vérifier qu'il apparaît dans Google Calendar
5. Vérifier la notification sur le téléphone

---

## Dépannage

**Problème** : Edge Function ne se déploie pas
- Vérifier que Supabase CLI est bien installé : `npx supabase --version`
- Vérifier le lien projet : `npx supabase link --project-ref uskjzczcuawhmrlwszpc`

**Problème** : Pas de synchronisation
- Vérifier les logs de la fonction : **Supabase Dashboard** → **Edge Functions** → **sync-google-calendar** → **Logs**
- Vérifier que le token Google est bien enregistré dans la table `google_calendar_tokens`
