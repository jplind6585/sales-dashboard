// One KPI tile, two tones (PLATFORM_REVIEW §5.5 — retires the saturated gradient heroes for a
// single flat/dark card system). Dark = navy card + coral number (the deck's stat-card look);
// light = white card + coral number. Positive-money accents use `success`.
export default function StatTile({ label, value, sub, icon: Icon, tone = 'light', accent = 'coral', className = '' }) {
  const dark = tone === 'dark';
  const numberColor = accent === 'success' ? 'text-success' : dark ? 'text-coral-400' : 'text-coral-600';
  return (
    <div
      className={`rounded-card p-4 ${dark ? 'bg-navy' : 'bg-white border border-hairline'} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wide ${dark ? 'text-white/60' : 'text-slate-500'}`}>{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${dark ? 'text-white/40' : 'text-slate-300'}`} />}
      </div>
      <div className={`font-display text-2xl mt-1 ${numberColor}`}>{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${dark ? 'text-white/50' : 'text-slate-400'}`}>{sub}</div>}
    </div>
  );
}
