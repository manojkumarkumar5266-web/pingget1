-- Fix: DP signup inserts status='pending' into profiles, but the CHECK
-- constraint only allows active/suspended/banned. Add 'pending' and
-- 'rejected' so the DP application flow works.
ALTER TABLE profiles DROP CONSTRAINT profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status = ANY (ARRAY['active', 'pending', 'rejected', 'suspended', 'banned']));