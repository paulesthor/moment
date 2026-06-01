
// Supabase Configuration
const SUPABASE_URL = 'https://uskjzczcuawhmrlwszpc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVza2p6Y3pjdWF3aG1ybHdzenBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTE4NzgsImV4cCI6MjA4NTc4Nzg3OH0.ombvKQ-6hRU746rj7i-EsCFc5P-54EzkGVvln5vu5GM';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: window.sessionStorage
    }
}) : null;

if (!supabase) {
    console.error('Supabase client not initialized. Make sure to include the Supabase JS library in your HTML.');
}

export { supabase };
