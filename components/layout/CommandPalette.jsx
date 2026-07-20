import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Search, CornerDownLeft, Building2 } from 'lucide-react';
import { MODULES } from '../../lib/moduleRegistry';
import { stageLabel } from '../../lib/constants';

// ⌘K command palette (PLATFORM_REVIEW §3.1): fuzzy-search accounts and jump to any module from
// anywhere. Mounted globally in _app inside AuthGuard.
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const loadAccounts = useCallback(async () => {
    if (accounts) return;
    try { const r = await fetch('/api/search'); const j = await r.json(); setAccounts(j.accounts || []); }
    catch { setAccounts([]); }
  }, [accounts]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true); // AppShell search pill dispatches this
    window.addEventListener('keydown', onKey);
    window.addEventListener('cmdk:open', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('cmdk:open', onOpen); };
  }, []);

  useEffect(() => {
    if (open) { loadAccounts(); setQ(''); setIdx(0); const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }
  }, [open, loadAccounts]);
  useEffect(() => { setOpen(false); }, [router?.asPath]);

  const nq = q.trim().toLowerCase();
  const moduleResults = MODULES
    .filter((m) => m.key !== 'all-modules' && (!nq || m.label.toLowerCase().includes(nq) || (m.desc || '').toLowerCase().includes(nq)))
    .slice(0, 6)
    .map((m) => ({ kind: 'module', label: m.label, sub: m.group, href: m.href, icon: m.icon }));
  const acctResults = (nq && accounts ? accounts.filter((a) => (a.name || '').toLowerCase().includes(nq)).slice(0, 8) : [])
    .map((a) => ({ kind: 'account', label: a.name, sub: `${stageLabel(a.stage)}${a.owner_name ? ' · ' + a.owner_name : ''}`, href: `/modules/account-pipeline?account=${a.id}`, icon: Building2 }));
  const results = [...acctResults, ...moduleResults];

  const go = (r) => { if (!r) return; setOpen(false); router.push(r.href); };
  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[idx]); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30" onMouseDown={() => setOpen(false)}>
      <div className="bg-white rounded-card shadow-2xl w-full max-w-xl mx-4 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-hairline">
          <Search className="w-4 h-4 text-slate-400" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onInputKey}
            placeholder="Search accounts or jump to a module…" className="flex-1 py-3.5 text-sm outline-none bg-transparent" />
          <kbd className="text-[10px] text-slate-400 border border-hairline rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <div className="px-4 py-6 text-sm text-slate-400 text-center">{nq ? 'No matches.' : 'Type to search accounts, or pick a module.'}</div>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <button key={r.kind + r.href} onMouseEnter={() => setIdx(i)} onClick={() => go(r)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === idx ? 'bg-coral-50' : 'hover:bg-slate-50'}`}>
                {Icon && <Icon className={`w-4 h-4 shrink-0 ${i === idx ? 'text-coral-600' : 'text-slate-400'}`} />}
                <span className="flex-1 min-w-0 truncate"><span className="text-sm text-ink">{r.label}</span><span className="text-xs text-slate-400 ml-2">{r.sub}</span></span>
                {r.kind === 'account' && <span className="text-[10px] text-slate-300 uppercase shrink-0">account</span>}
                {i === idx && <CornerDownLeft className="w-3.5 h-3.5 text-coral-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
