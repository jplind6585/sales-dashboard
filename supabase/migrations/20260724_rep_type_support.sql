-- Allow 'support' (back-office Sales Admin) as a rep_type, alongside sdr/ae.
-- Yapul, Ley, Hannah are sales admins who use the app but are not sellers.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rep_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_rep_type_check
  CHECK (rep_type = ANY (ARRAY['sdr'::text, 'ae'::text, 'support'::text]));
