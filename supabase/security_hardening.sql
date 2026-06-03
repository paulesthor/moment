-- ═══════════════════════════════════════════════════════
-- SECURITY HARDENING — Moments d'Évasion
-- ═══════════════════════════════════════════════════════

-- 1. Fonction SECURITY DEFINER pour vérifier le rôle admin
--    sans récursion dans les RLS policies
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_safe() TO authenticated, anon;

-- 2. Profils: restreindre la lecture (plus d'emails/rôles publics)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Users view own profile"    ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles"  ON profiles FOR SELECT USING (is_admin_safe());

-- 3. Empêcher les utilisateurs de changer leur propre rôle
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON profiles;
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- 4. Messages: empêcher un client de se faire passer pour admin
DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND is_admin_reply = false);

-- 5. Appointments: forcer le statut initial à 'demandé' côté client
DROP POLICY IF EXISTS "Clients create appointments" ON appointments;
CREATE POLICY "Clients create appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.uid() = client_id AND status = 'demandé');
