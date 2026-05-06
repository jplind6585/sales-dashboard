import { getSupabase } from './supabase';

let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSalesProcessConfig() {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL) return _cache;

  const db = getSupabase();
  const { data, error } = await db
    .from('sales_process_config')
    .select('*')
    .limit(1)
    .single();

  if (error || !data) return null;
  _cache = data;
  _cacheTs = now;
  return data;
}

export function buildSalesProcessContext(config) {
  if (!config) return '';
  return `
=== BANNER SALES PROCESS CONFIGURATION ===
(This is the current, authoritative sales process definition. Use it to calibrate all scoring and coaching.)

ICP DEFINITION:
${config.icp_definition}

DISCOVERY FRAMEWORK:
${config.discovery_framework}

STAGE EXIT CRITERIA:
${config.stage_exit_criteria}

DISQUALIFICATION SIGNALS:
${config.disqualification_signals}

COACHING PRIORITIES:
${config.coaching_priorities}

QUALIFICATION FRAMEWORK:
${config.qualification_framework}
`.trim();
}
