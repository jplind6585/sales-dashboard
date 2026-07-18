// The ONE stage-transition writer. Before this, the DB trigger was dropped (20260515) and only
// some app paths recorded moves — the nightly HubSpot sync wrote accounts.stage via a raw upsert
// that bypassed every history writer, so most real transitions were never recorded and the funnel
// was unreliable (PLATFORM_REVIEW §6/§8). Route ALL stage changes through recordStageChange.

// db: a service-role client (getSupabase()). Safe/best-effort — never throws into the caller.
export async function recordStageChange(db, { accountId, fromStage, toStage, changedById = null, changedByName = null, dealValue = null }) {
  if (!db || !accountId || !toStage || fromStage === toStage) return;
  try {
    let daysInPrior = null;
    const { data: last } = await db
      .from('account_stage_history')
      .select('changed_at')
      .eq('account_id', accountId)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.changed_at) {
      daysInPrior = Math.max(0, Math.round((Date.now() - new Date(last.changed_at).getTime()) / 86400000));
    }
    await db.from('account_stage_history').insert({
      account_id: accountId,
      from_stage: fromStage || null,
      to_stage: toStage,
      changed_by: changedById || null,
      changed_by_name: changedByName || null,
      days_in_prior_stage: daysInPrior,
      deal_value_at_change: dealValue != null ? dealValue : null,
    });
  } catch (e) {
    console.error('[stageHistory] record failed for', accountId, e.message);
  }
}
