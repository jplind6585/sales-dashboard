// People tab (Account View redesign, §7.3). An influence map that sells multi-threading, not a contact
// list. Reads account.stakeholders (populated + provenance-stamped by the Step A extraction backfill).
import { useMemo } from 'react';
import { Crown, Wallet, Users, AlertTriangle, FileText } from 'lucide-react';

const ROLE_LABELS = {
  champion: 'Champion', economic_buyer: 'Economic Buyer', technical_buyer: 'Technical Buyer',
  user_buyer: 'User', user: 'User', influencer: 'Influencer', blocker: 'Blocker',
  gatekeeper: 'Gatekeeper', technical_evaluator: 'Technical Evaluator', unknown: 'Unknown',
};
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '_');
const roleOf = (p) => norm(p.roleGuess || p.role || 'unknown');
const evCount = (p) => (Array.isArray(p.evidence) ? p.evidence.length : 0);

function Receipts({ person }) {
  const n = evCount(person);
  if (!n) return <span className="text-xs text-gray-300">no source yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400" title="Derived from call evidence">
      <FileText className="w-3 h-3" /> seen in {n} call{n > 1 ? 's' : ''}
    </span>
  );
}

function PersonRow({ person }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{person.name}</p>
        <p className="text-xs text-gray-400 truncate">{person.title || ROLE_LABELS[roleOf(person)] || 'Unknown'}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Receipts person={person} />
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{ROLE_LABELS[roleOf(person)] || 'Unknown'}</span>
      </div>
    </div>
  );
}

export default function PeopleTab({ account }) {
  const people = account?.stakeholders || [];
  const { champions, ebs, others } = useMemo(() => {
    const champions = [], ebs = [], others = [];
    for (const p of people) {
      const r = roleOf(p);
      if (r.includes('champion')) champions.push(p);
      else if (r.includes('economic')) ebs.push(p);
      else others.push(p);
    }
    return { champions, ebs, others };
  }, [people]);

  if (!people.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No people mapped yet. They populate automatically as calls are analyzed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Champion */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900">Champion{champions.length > 1 ? 's' : ''}</h3>
        </div>
        {champions.length ? champions.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-1.5">
            <div><span className="text-sm font-medium text-gray-900">{p.name}</span>{p.title && <span className="text-xs text-gray-400 ml-2">{p.title}</span>}</div>
            <div className="flex items-center gap-3">
              {p.championStrength && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{p.championStrength}</span>}
              <Receipts person={p} />
            </div>
          </div>
        )) : (
          <p className="text-xs text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> No champion identified. Single-threaded risk, find and develop one.</p>
        )}
      </div>

      {/* Economic buyer */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Economic Buyer</h3>
        </div>
        {ebs.length ? ebs.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-1.5">
            <div><span className="text-sm font-medium text-gray-900">{p.name}</span>{p.title && <span className="text-xs text-gray-400 ml-2">{p.title}</span>}</div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{p.ebStatus || 'identified'}</span>
              <Receipts person={p} />
            </div>
          </div>
        )) : (
          <p className="text-xs text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Economic buyer not identified. This is a Watch risk, get access before proposal.</p>
        )}
      </div>

      {/* Everyone else */}
      {others.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Everyone else <span className="text-gray-400 font-normal">({others.length})</span></h3>
          </div>
          {others.map((p) => <PersonRow key={p.id} person={p} />)}
        </div>
      )}
    </div>
  );
}
