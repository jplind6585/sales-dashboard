import { AlertTriangle } from 'lucide-react'

// Renders the structured proposal/eval doc (lib/proposalSpec schema) into readable sections.
// Section 1 is the champion-facing deck copy; Section 2 is the internal rep working section.
const Quote = ({ q }) => {
  if (!q?.text) return null
  return (
    <div className={`text-sm italic border-l-2 pl-3 my-2 ${q.unverified ? 'border-amber-300 text-amber-700' : 'border-coral-300 text-gray-600'}`}>
      "{q.text}"
      <div className="text-xs not-italic text-gray-400 mt-0.5">
        — {q.speaker || 'Unknown'}{q.call ? `, ${q.call}` : ''}{q.timestamp ? `, ${q.timestamp}` : ''}
        {q.unverified && <span className="ml-1 text-amber-600">· not verbatim-verified</span>}
      </div>
    </div>
  )
}

const Bullets = ({ items, className = '' }) => (
  <ul className={`space-y-1 ${className}`}>
    {(items || []).map((b, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-gray-300 mt-1">•</span><span>{b}</span></li>)}
  </ul>
)

export default function ProposalDocView({ doc }) {
  if (!doc) return null
  const rw = doc.section2_repWorking || {}
  const vl = doc.versionLog?.[0]

  return (
    <div className="space-y-6">
      {vl && <p className="text-xs text-gray-400 italic">v{vl.version}: {vl.changed}</p>}

      {/* Section 1 — deck-ready */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-coral-600 mb-3">Deck-Ready Copy</h3>
        <div className="space-y-5">
          {(doc.section1_deckReady || []).map((a, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4">
              <div className="font-semibold text-gray-900 mb-2">{a.label}</div>
              <Bullets items={a.currentState} />
              <Bullets items={a.problems} className="mt-1" />
              <Quote q={a.quote} />
              <div className="text-coral-500 font-semibold my-1">→</div>
              <Bullets items={a.idealStateWithBanner} />
            </div>
          ))}
        </div>
      </section>

      {/* Deal summary */}
      {doc.dealSummary && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Deal Summary</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{doc.dealSummary}</p>
        </section>
      )}

      {/* ROI */}
      {doc.roiSnapshot?.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">ROI Snapshot</h3>
          <div className="space-y-3">
            {doc.roiSnapshot.map((r, i) => (
              <div key={i} className="text-sm">
                <div className="font-medium text-gray-800">{r.label}{r.estimate ? ` — ${r.estimate}` : ''}</div>
                {r.notQuantifiable && <div className="text-xs text-amber-600">ROI not yet quantifiable — see questions</div>}
                {r.assumptions?.length > 0 && <div className="text-xs text-gray-500 mt-0.5">Assumptions: {r.assumptions.join('; ')}</div>}
                {r.questionsToSharpen?.length > 0 && <div className="text-xs text-gray-500">To sharpen: {r.questionsToSharpen.join(' ')}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Voice of customer */}
      {doc.voiceOfCustomer?.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Voice of Customer</h3>
          {doc.voiceOfCustomer.map((v, i) => (
            <div key={i} className="mb-2">
              <div className="text-xs font-medium text-gray-600">{v.label}</div>
              {(v.quotes || []).map((q, j) => <Quote key={j} q={q} />)}
            </div>
          ))}
        </section>
      )}

      {/* Section 2 — rep working */}
      <section className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-1.5 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rep Working — internal, do not share</h3>
        </div>

        {rw.coverageMap?.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-1 pr-2">Area</th><th className="py-1 pr-2">Status</th><th className="py-1 pr-2">Conf.</th><th className="py-1">Notes</th>
              </tr></thead>
              <tbody>
                {rw.coverageMap.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 pr-2 font-medium text-gray-700 whitespace-nowrap">{c.label}</td>
                    <td className="py-1 pr-2 whitespace-nowrap"><StatusPill status={c.status} /></td>
                    <td className="py-1 pr-2 text-gray-500">{c.confidence}</td>
                    <td className="py-1 text-gray-600">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rw.stakeholderMap?.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-600 mb-1">Stakeholders</div>
            {rw.stakeholderMap.map((s, i) => (
              <div key={i} className="text-sm text-gray-700">
                <span className="font-medium">{s.name}</span>{s.title ? ` (${s.title})` : ''}
                {s.concerns?.length > 0 && <span className="text-gray-500"> — {s.concerns.join('; ')}</span>}
                {s.notes && <span className="text-gray-400 italic"> · {s.notes}</span>}
              </div>
            ))}
          </div>
        )}

        {rw.openQuestions && (
          <div className="mb-4 text-sm">
            <div className="text-xs font-medium text-gray-600 mb-1">Open Questions / Next-Call Agenda</div>
            <QGroup title="Confirm/deepen pain" items={rw.openQuestions.confirmPain} />
            <QGroup title="Complete ROI" items={rw.openQuestions.completeRoi} />
            <QGroup title="Uncover areas" items={rw.openQuestions.uncoverAreas} />
            <QGroup title="Advance the deal" items={rw.openQuestions.advanceDeal} />
          </div>
        )}

        {rw.dealHealth && (
          <div className="text-sm bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-600 mb-1">Deal Health</div>
            {rw.dealHealth.confirmedPains?.length > 0 && <div className="text-xs text-gray-600">Confirmed pains: {rw.dealHealth.confirmedPains.join(', ')}</div>}
            {rw.dealHealth.stillUnqualified?.length > 0 && <div className="text-xs text-gray-600">Still unqualified: {rw.dealHealth.stillUnqualified.join(', ')}</div>}
            {rw.dealHealth.keyNextStep && <div className="text-xs text-gray-800 mt-1">Key next step: {rw.dealHealth.keyNextStep}</div>}
            {rw.dealHealth.risks?.length > 0 && <div className="text-xs text-amber-700 mt-1">Risks: {rw.dealHealth.risks.join(' ')}</div>}
          </div>
        )}
      </section>
    </div>
  )
}

const QGroup = ({ title, items }) => (!items?.length ? null : (
  <div className="mb-1.5">
    <div className="text-xs text-gray-400 italic">{title}</div>
    <ul className="space-y-0.5">{items.map((q, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-gray-300">•</span><span>{q}</span></li>)}</ul>
  </div>
))

const StatusPill = ({ status }) => {
  const map = {
    'Confirmed pain': 'bg-red-50 text-red-700 border-red-200',
    'Discussed - unclear': 'bg-amber-50 text-amber-700 border-amber-200',
    'Not yet discussed': 'bg-gray-50 text-gray-500 border-gray-200',
    'Inferred': 'bg-blue-50 text-blue-700 border-blue-200',
    'Confirmed not relevant': 'bg-gray-100 text-gray-400 border-gray-200',
  }
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${map[status] || map['Not yet discussed']}`}>{status}</span>
}
