-- Fix RLS Policy for Admin to Update Messages
-- This allows admins to mark messages as read

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can update all messages" ON messages;

-- Create a policy allowing admins to update messages
CREATE POLICY "Admins can update all messages"
ON messages
FOR UPDATE
USING (
  -- Allow if user is admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Also ensure admins can select all messages (should already exist but let's be sure)
DROP POLICY IF EXISTS "Admins can view all messages" ON messages;

CREATE POLICY "Admins can view all messages"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
  OR
  user_id = auth.uid()
);
