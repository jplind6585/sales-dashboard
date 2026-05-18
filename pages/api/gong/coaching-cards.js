import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createServerSupabaseClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const db = getSupabase();

  const { data: profile } = await db
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.email) return res.status(404).json({ error: 'Profile not found' });

  const { data: cards, error } = await db
    .from('call_coaching_cards')
    .select('id, account_name, call_date, strength, fix, next_focus, full_message, sent_at, gong_call_id')
    .eq('rep_email', profile.email)
    .order('sent_at', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true, cards: cards || [] });
}
