-- Phase 1 big build migrations

-- rep_type on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rep_type TEXT CHECK (rep_type IN ('sdr', 'ae'));

-- Account Pursuit Lists (SDR top-50 named accounts)
CREATE TABLE IF NOT EXISTS account_pursuit_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  rank INTEGER,
  hypothesis TEXT,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, account_id)
);

-- Account Touches (multi-channel SDR activity log)
CREATE TABLE IF NOT EXISTS account_touches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  touch_type TEXT NOT NULL CHECK (touch_type IN ('call', 'email', 'linkedin', 'meeting', 'voicemail')),
  touched_at TIMESTAMPTZ DEFAULT now(),
  outcome TEXT CHECK (outcome IN ('connected', 'voicemail', 'no_answer', 'replied', 'meeting_booked', 'not_interested', 'other')),
  notes TEXT
);

-- Meeting Quality Scores (SDR → AE warm transfer quality)
CREATE TABLE IF NOT EXISTS meeting_quality_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  ae_user_id UUID REFERENCES auth.users(id),
  sdr_user_id UUID REFERENCES auth.users(id),
  meeting_date TIMESTAMPTZ,
  persona_fit INTEGER CHECK (persona_fit BETWEEN 1 AND 5),
  pain_confirmed INTEGER CHECK (pain_confirmed BETWEEN 1 AND 5),
  qualified BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily Insights (AI-generated per-rep daily insight)
CREATE TABLE IF NOT EXISTS daily_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_date DATE NOT NULL DEFAULT CURRENT_DATE,
  insight TEXT NOT NULL,
  account_name TEXT,
  account_id UUID REFERENCES accounts(id),
  action_recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, insight_date)
);

-- Enable RLS on new tables
ALTER TABLE account_pursuit_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_touches ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies: users see their own rows
CREATE POLICY "Users see own pursuit lists" ON account_pursuit_lists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own touches" ON account_touches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own insights" ON daily_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see meeting scores they're involved in" ON meeting_quality_scores FOR ALL USING (auth.uid() = ae_user_id OR auth.uid() = sdr_user_id);
