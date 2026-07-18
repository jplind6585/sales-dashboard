import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Check, TrendingUp, Loader2 } from 'lucide-react'
import { fmtUsd } from '../../../lib/metrics'

// Public Living Deal Room (M5) — a branded, engagement-tracked microsite for a prospect. No auth
// (served under /share/*). Numbers are grounded in the account's own metrics or omitted.
export default function DealRoom() {
  const router = useRouter()
  const { token } = router.query
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/public/deal-room?token=${token}`).then((r) => r.json()).then((j) => { if (j.success === false) throw new Error(j.error); setData(j) }).catch((e) => setErr(e.message))
  }, [token])

  if (err) return <div className="min-h-screen bg-canvas flex items-center justify-center text-slate-500">This deal room link is not valid.</div>
  if (!data) return <div className="min-h-screen bg-canvas flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>

  const { account, value, benefits, proof } = data
  return (
    <div className="min-h-screen bg-canvas font-sans">
      <Head><title>Banner · {account.name}</title></Head>

      {/* Hero */}
      <div className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border-[20px] border-coral-500/20" />
          <div className="flex items-center gap-2 mb-8">
            <span className="w-6 h-6 rounded bg-coral-500 flex items-center justify-center font-display font-semibold">B</span>
            <span className="font-display font-semibold">Banner</span>
          </div>
          <p className="text-coral-400 text-sm font-medium mb-2">Prepared for {account.name}</p>
          <h1 className="font-display text-4xl leading-tight mb-4">Transforming CapEx management for {account.name}</h1>
          {value.hasData ? (
            <p className="text-white/70 text-lg">Estimated annual value with Banner: <span className="text-coral-400 font-display">{fmtUsd(value.total)}</span></p>
          ) : (
            <p className="text-white/70 text-lg">A modern, configurable CapEx platform built for commercial real estate.</p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Value breakdown */}
        {value.hasData && (
          <section>
            <h2 className="font-display text-xl text-ink mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-coral-500" /> Your estimated annual value</h2>
            <div className="bg-white rounded-card border border-hairline divide-y divide-hairline">
              {value.lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-4">
                  <div><p className="text-sm font-medium text-ink">{l.label}</p><p className="text-xs text-slate-500">{l.detail}</p></div>
                  <span className="font-display text-lg text-coral-600 shrink-0">{fmtUsd(l.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 p-4 bg-coral-50">
                <p className="text-sm font-semibold text-ink">Estimated annual value</p>
                <span className="font-display text-xl text-coral-700">{fmtUsd(value.total)}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Estimate based on your figures and Banner customer benchmarks. We'll refine it together.</p>
          </section>
        )}

        {/* Benefits */}
        <section>
          <h2 className="font-display text-xl text-ink mb-4">Why teams choose Banner</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {benefits.map((b, i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-4">
                <div className="flex items-center gap-2 mb-1"><Check className="w-4 h-4 text-success" /><p className="text-sm font-semibold text-ink">{b.title}</p></div>
                <p className="text-xs text-slate-500">{b.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Proof */}
        <section>
          <h2 className="font-display text-xl text-ink mb-3">Trusted by leading owners & operators</h2>
          <div className="flex flex-wrap gap-2">
            {proof.map((p) => <span key={p} className="px-3 py-1.5 bg-white border border-hairline rounded-full text-sm text-slate-600">{p}</span>)}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white rounded-card border border-hairline p-6 text-center">
          <p className="font-display text-lg text-ink mb-1">Ready to see it on your portfolio?</p>
          <p className="text-sm text-slate-500 mb-4">We'll tailor a walkthrough to {account.name}'s processes.</p>
          <a href={`mailto:hello@withbanner.com?subject=${encodeURIComponent('Banner for ' + account.name)}`} className="inline-block px-5 py-2.5 bg-coral-600 text-white rounded-lg text-sm font-medium hover:bg-coral-700">Book a walkthrough</a>
        </section>

        <p className="text-center text-xs text-slate-400 pt-4">© {new Date().getFullYear()} Banner Technologies</p>
      </div>
    </div>
  )
}
