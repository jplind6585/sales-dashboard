// Grounded value model for the Living Deal Room (M5). Numbers come ONLY from the account's real
// metrics × the deck's published benchmarks (see BRAND_GUIDE.md product context). If a metric is
// missing, that line is omitted rather than invented — the room falls back to qualitative value.
const BENCH = {
  capexSavingsPct: 0.033,     // ~3.3% capex-budget savings
  daysSavedPerTurn: 4.1,      // per unit turn
};

function mval(metrics, id) {
  if (!metrics) return null;
  const m = metrics[id];
  const v = m && typeof m === 'object' ? (m.value ?? m.amount) : m;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export function computeDealValue(account) {
  const metrics = account?.metrics || {};
  const spend = mval(metrics, 'annual_construction_spend');
  const renos = mval(metrics, 'unit_renos_per_year');
  const rent = mval(metrics, 'avg_rent');

  const lines = [];
  let total = 0;
  if (spend) {
    const v = spend * BENCH.capexSavingsPct;
    lines.push({ label: 'CapEx budget savings', detail: `~3.3% of $${Math.round(spend).toLocaleString()} annual construction spend`, value: Math.round(v) });
    total += v;
  }
  if (renos && rent) {
    const v = renos * BENCH.daysSavedPerTurn * (rent / 30);
    lines.push({ label: 'Faster unit turns', detail: `${renos.toLocaleString()} renovations/yr × ${BENCH.daysSavedPerTurn} days saved × daily rent`, value: Math.round(v) });
    total += v;
  }

  return { total: Math.round(total), lines, hasData: lines.length > 0 };
}

// Always-true qualitative value + proof, straight from the deck (safe to show any prospect).
export const BANNER_BENEFITS = [
  { title: 'Reduce ~80% of admin time', detail: 'Over 10 hrs/person/week recovered while cutting data errors ~99%.' },
  { title: 'Control costs', detail: 'Lock budgets, route approvals through your process, track committed vs. budget in real time.' },
  { title: 'Better vendor terms', detail: 'Solicit and level competitive bids easily — customers save ~2.4% on hard costs.' },
  { title: 'Accelerate pre-construction', detail: 'Automated bid/approval/change-order workflows keep projects moving.' },
];

export const BANNER_PROOF = ['LivCor (Blackstone)', 'American Campus Communities', 'April Housing', 'AIR Communities', 'FCP', 'Greystar'];
