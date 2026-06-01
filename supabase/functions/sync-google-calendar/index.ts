/**
 * Supabase Edge Function: sync-google-calendar
 * 
 * Cette fonction est appelée automatiquement quand un rendez-vous est créé/modifié/supprimé.
 * Elle synchronise les changements avec Google Calendar.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

serve(async (req) => {
    try {
        const { type, record, old_record } = await req.json();

        // Créer client Supabase avec service role key (accès complet)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Récupérer le refresh token de l'admin
        const { data: tokenData, error: tokenError } = await supabaseAdmin
            .from('google_calendar_tokens')
            .select('refresh_token, access_token, token_expires_at')
            .limit(1)
            .single();

        if (tokenError || !tokenData) {
            console.log('No Google Calendar token found');
            return new Response(JSON.stringify({ error: 'No token' }), { status: 200 });
        }

        // Rafraîchir le token si expiré
        let accessToken = tokenData.access_token;
        if (!accessToken || new Date(tokenData.token_expires_at) < new Date()) {
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
                    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
                    refresh_token: tokenData.refresh_token,
                    grant_type: 'refresh_token'
                })
            });

            const tokenJson = await refreshResponse.json();
            accessToken = tokenJson.access_token;

            // Sauvegarder le nouveau token
            await supabaseAdmin
                .from('google_calendar_tokens')
                .update({
                    access_token: accessToken,
                    token_expires_at: new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
                })
                .eq('refresh_token', tokenData.refresh_token);
        }

        // Gérer selon le type d'événement
        if (type === 'INSERT') {
            // Créer événement Google Calendar
            const event = {
                summary: `RDV - ${record.client_name}`,
                description: `Service: ${record.service_type}`,
                start: {
                    dateTime: record.start_time,
                    timeZone: 'Europe/Paris'
                },
                end: {
                    dateTime: record.end_time,
                    timeZone: 'Europe/Paris'
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 30 },
                        { method: 'email', minutes: 1440 } // 24h avant
                    ]
                }
            };

            const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });

            const googleEvent = await response.json();

            // Sauvegarder l'ID Google dans la BDD
            await supabaseAdmin
                .from('appointments')
                .update({ google_event_id: googleEvent.id })
                .eq('id', record.id);

            return new Response(JSON.stringify({ success: true, eventId: googleEvent.id }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } else if (type === 'UPDATE' && record.google_event_id) {
            // Mettre à jour événement existant
            const event = {
                summary: `RDV - ${record.client_name}`,
                description: `Service: ${record.service_type}`,
                start: {
                    dateTime: record.start_time,
                    timeZone: 'Europe/Paris'
                },
                end: {
                    dateTime: record.end_time,
                    timeZone: 'Europe/Paris'
                }
            };

            await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${record.google_event_id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } else if (type === 'DELETE' && old_record.google_event_id) {
            // Supprimer événement
            await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${old_record.google_event_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
