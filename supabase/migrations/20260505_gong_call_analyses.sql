-- Run in Supabase SQL Editor (Sales AI Brain project)
-- Adds caching tables for the Call Intelligence report

CREATE TABLE IF NOT EXISTS public.gong_call_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gong_call_id TEXT UNIQUE NOT NULL,
  title TEXT,
  call_date TIMESTAMPTZ,
  call_type TEXT DEFAULT 'other',
  rep_name TEXT,
  rep_email TEXT,
  duration_seconds INTEGER DEFAULT 0,
  gong_url TEXT,
  analysis JSONB DEFAULT '{}',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gong_aggregate_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  call_count INTEGER DEFAULT 0,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  analysis JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS gong_call_analyses_gong_call_id_idx ON public.gong_call_analyses(gong_call_id);
CREATE INDEX IF NOT EXISTS gong_call_analyses_call_date_idx ON public.gong_call_analyses(call_date DESC);
CREATE INDEX IF NOT EXISTS gong_aggregate_analysis_computed_at_idx ON public.gong_aggregate_analysis(computed_at DESC);

-- Grant access so the API works even without the service role key
GRANT ALL ON TABLE public.gong_call_analyses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gong_aggregate_analysis TO anon, authenticated, service_role;
