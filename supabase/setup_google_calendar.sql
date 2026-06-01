-- Google Calendar Sync - Database Setup
-- Ce script crée les tables nécessaires pour la synchronisation Google Calendar

-- Table pour stocker les refresh tokens Google
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS pour google_calendar_tokens
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent voir leurs propres tokens
CREATE POLICY "Admins can manage their own tokens"
ON google_calendar_tokens
FOR ALL
USING (
    auth.uid() = user_id 
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Ajouter colonne google_event_id à appointments (si pas déjà fait)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Index pour retrouver rapidement les événements par google_event_id
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id 
ON appointments(google_event_id);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour google_calendar_tokens
DROP TRIGGER IF EXISTS update_google_calendar_tokens_updated_at ON google_calendar_tokens;
CREATE TRIGGER update_google_calendar_tokens_updated_at
    BEFORE UPDATE ON google_calendar_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
