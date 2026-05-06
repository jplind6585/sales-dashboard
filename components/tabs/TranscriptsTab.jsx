import { useState, useEffect, useMemo } from 'react';
import { Upload, Calendar, Users, ArrowRight, ExternalLink, Mail, FileText, Loader2, ChevronDown, ChevronUp, MessageSquare, Tag, AlertCircle, CheckCircle, ChevronRight, Zap, TrendingUp, Clock } from 'lucide-react';
import { getUserSettings } from '../../lib/userSettings';

const CALL_TYPES = [
  { id: 'intro', label: 'Intro Call', color: 'bg-blue-100 text-blue-700' },
  { id: 'discovery', label: 'Discovery', color: 'bg-purple-100 text-purple-700' },
  { id: 'demo', label: 'Demo', color: 'bg-green-100 text-green-700' },
  { id: 'pricing', label: 'Pricing', color: 'bg-amber-100 text-amber-700' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  { id: 'follow_up', label: 'Follow-up', color: 'bg-gray-100 text-gray-700' },
  { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700' }
];

const ANNOTATION_TYPES = {
  objection: { label: 'Objection', bg: 'bg-red-50', border: 'border-l-2 border-red-400', text: 'text-red-700', chip: 'bg-red-100 text-red-700' },
  buying_signal: { label: 'Buying Signal', bg: 'bg-green-50', border: 'border-l-2 border-green-400', text: 'text-green-700', chip: 'bg-green-100 text-green-700' },
  next_step: { label: 'Next Step', bg: 'bg-blue-50', border: 'border-l-2 border-blue-400', text: 'text-blue-700', chip: 'bg-blue-100 text-blue-700' },
  red_flag: { label: 'Red Flag', bg: 'bg-orange-50', border: 'border-l-2 border-orange-400', text: 'text-orange-700', chip: 'bg-orange-100 text-orange-700' },
}

function extractKeywords(strings) {
  if (!strings?.length) return []
  const stopWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'have', 'will', 'they', 'from', 'been', 'their', 'about', 'would', 'could', 'should'])
  return strings.flatMap(s =>
    (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w))
  )
}

function classifyLine(line, keywordSets) {
  const lower = line.toLowerCase()
  for (const [type, keywords] of Object.entries(keywordSets)) {
    if (keywords.some(kw => lower.includes(kw))) return type
  }
  return null
}

function AnnotatedTranscript({ transcript }) {
  const analysis = transcript.rawAnalysis || transcript.analysis || {}
  const text = transcript.text || ''

  const keywordSets = useMemo(() => ({
    objection: extractKeywords((analysis.objections || []).map(o => typeof o === 'string' ? o : o.text)),
    buying_signal: extractKeywords(analysis.buyingSignals || analysis.buying_signals || []),
    next_step: extractKeywords(analysis.nextSteps || analysis.next_steps_mentioned || []),
    red_flag: extractKeywords(analysis.redFlags || analysis.red_flags || []),
  }), [analysis])

  const hasAnnotations = Object.values(keywordSets).some(kws => kws.length > 0)

  const lines = useMemo(() => {
    return text.split('\n').map(line => {
      const isRep = line.startsWith('[REP]') || /^[A-Z][^:]+\s\(Banner\):/i.test(line)
      const isProspect = line.startsWith('[PROSPECT]') || (!isRep && /^[A-Z][^:]+:/i.test(line) && !line.startsWith('['))
      const annotation = hasAnnotations ? classifyLine(line, keywordSets) : null
      return { line, isRep, isProspect, annotation }
    })
  }, [text, keywordSets, hasAnnotations])

  const annotatedCount = lines.filter(l => l.annotation).length

  if (!text) return <p className="text-sm text-gray-400 italic">No transcript text available.</p>

  return (
    <div>
      {hasAnnotations && annotatedCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3 pb-3 border-b">
          <span className="text-xs text-gray-400">{annotatedCount} annotated moment{annotatedCount > 1 ? 's' : ''} ·</span>
          {Object.entries(ANNOTATION_TYPES).map(([type, meta]) => {
            const count = lines.filter(l => l.annotation === type).length
            if (!count) return null
            return (
              <span key={type} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.chip}`}>
                {meta.label} ({count})
              </span>
            )
          })}
        </div>
      )}
      <div className="space-y-0.5 font-mono text-xs overflow-y-auto max-h-96">
        {lines.map((entry, i) => {
          if (!entry.line.trim()) return <div key={i} className="h-2" />
          const annotMeta = entry.annotation ? ANNOTATION_TYPES[entry.annotation] : null
          return (
            <div
              key={i}
              className={`px-2 py-0.5 rounded-sm leading-relaxed transition-colors ${
                annotMeta ? `${annotMeta.bg} ${annotMeta.border} pl-3` : ''
              } ${entry.isRep ? 'text-blue-900' : entry.isProspect ? 'text-gray-800' : 'text-gray-600'}`}
            >
              {annotMeta && (
                <span className={`text-xs font-semibold mr-1 ${annotMeta.text}`}>[{annotMeta.label}]</span>
              )}
              {entry.line}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Gong-analyzed call card (auto-linked, no raw transcript text) ──────────────
function GongCallCard({ call }) {
  const [expanded, setExpanded] = useState(false)

  const hasAttention = call.attentionScore >= 40
  const date = call.date
    ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const MEDDICC_LABELS = {
    metrics: 'Metrics', economic_buyer: 'Economic Buyer', decision_criteria: 'Decision Criteria',
    decision_process: 'Decision Process', identify_pain: 'Pain', champion: 'Champion', competition: 'Competition',
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${hasAttention ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className={`p-4 ${hasAttention ? 'bg-amber-50' : 'bg-gray-50'} border-b`}>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                <Zap className="w-3 h-3" /> AI Analysis
              </span>
              {hasAttention && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                  <AlertCircle className="w-3 h-3" /> Needs attention
                </span>
              )}
              {call.discoveryScore != null && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${call.discoveryScore >= 7 ? 'bg-green-100 text-green-700' : call.discoveryScore >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  Discovery {call.discoveryScore}/10
                </span>
              )}
              {call.talkRatio != null && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${call.talkRatio > 55 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                  {call.talkRatio}% talk
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900">{call.title || 'Gong Call'}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>
              {call.repName && <span>{call.repName}</span>}
            </div>
            {call.summary && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{call.summary}</p>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-400 hover:text-gray-600 ml-3 shrink-0">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {call.nextSteps?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Next Steps</div>
            <ul className="space-y-1">
              {call.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {call.commitments?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-100">
            <div className="text-xs font-medium text-gray-500 mb-1">Rep Commitments</div>
            <ul className="space-y-1">
              {call.commitments.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                  <span className="text-orange-400 shrink-0">→</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {expanded && (
        <div className="p-4 bg-white space-y-4">
          {call.redFlags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1.5">Red Flags</p>
              <ul className="space-y-1">
                {call.redFlags.map((f, i) => (
                  <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {call.buyingSignals?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-600 mb-1.5">Buying Signals</p>
              <ul className="space-y-1">
                {call.buyingSignals.map((s, i) => (
                  <li key={i} className="text-sm text-green-700 flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {call.objections?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Objections</p>
              <ul className="space-y-1">
                {call.objections.map((o, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {typeof o === 'string' ? o : `${o.text}${o.response ? ` — ${o.response}` : ''}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {call.meddicc && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">MEDDICC</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MEDDICC_LABELS).map(([key, label]) => {
                  const val = call.meddicc[key]
                  const empty = !val || val === 'unknown' || val === 'not identified' || val === 'not mentioned'
                  return (
                    <div key={key} className={`rounded-lg px-3 py-2 ${empty ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className={`text-xs font-semibold ${empty ? 'text-red-600' : 'text-green-700'}`}>{label}</p>
                      <p className={`text-xs mt-0.5 ${empty ? 'text-red-500 italic' : 'text-green-800'}`}>
                        {empty ? 'Not identified' : val}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Manual transcript card (existing behavior) ─────────────────────────────────
const TranscriptCard = ({ transcript, account, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [generatedContent, setGeneratedContent] = useState({ email: null, agenda: null, feedback: null });
  const [originalContent, setOriginalContent] = useState({ email: null });
  const [editedEmail, setEditedEmail] = useState('');
  const [detectedStage, setDetectedStage] = useState(null);

  const callType = CALL_TYPES.find(t => t.id === transcript.callType) || CALL_TYPES[CALL_TYPES.length - 1];
  const attendees = transcript.attendees || [];
  const nextSteps = transcript.rawAnalysis?.nextSteps || [];

  const STAGE_CONFIG = {
    intro: { label: 'Introduction', color: 'bg-blue-100 text-blue-700' },
    demo: { label: 'Demo', color: 'bg-green-100 text-green-700' },
    technical: { label: 'Technical', color: 'bg-purple-100 text-purple-700' },
    evaluation: { label: 'Evaluation', color: 'bg-amber-100 text-amber-700' },
    proposal: { label: 'Proposal', color: 'bg-orange-100 text-orange-700' }
  };

  const handleGenerateEmail = async () => {
    setGenerating('email');
    try {
      const settings = getUserSettings();
      const emailSignature = settings.emailSignature || '';
      const response = await fetch('/api/generate-follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, account, emailSignature })
      });
      const data = await response.json();
      if (data.content) {
        setGeneratedContent(prev => ({ ...prev, email: data.content }));
        setOriginalContent(prev => ({ ...prev, email: data.content }));
        setEditedEmail(data.content);
        if (data.detectedStage) setDetectedStage(data.detectedStage);
        if (data.generatedContent?.length > 0) {
          data.generatedContent.forEach(doc => {
            if (doc.pdfData && doc.pdfFilename) {
              const byteCharacters = atob(doc.pdfData);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
              const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = doc.pdfFilename;
              document.body.appendChild(a); a.click();
              document.body.removeChild(a); window.URL.revokeObjectURL(url);
            }
          });
        }
      }
    } catch (err) { console.error('Error generating email:', err); }
    finally { setGenerating(null); }
  };

  const generateEmailFromName = (name, accountUrl, accountName) => {
    let domain = '';
    if (accountUrl) {
      try {
        const url = new URL(accountUrl.startsWith('http') ? accountUrl : `https://${accountUrl}`);
        domain = url.hostname.replace('www.', '');
      } catch { domain = accountName?.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'; }
    } else {
      domain = accountName?.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    }
    const emailPrefix = name.toLowerCase().trim().replace(/[^a-z\s]/g, '').split(/\s+/).join('.');
    return `${emailPrefix}@${domain}`;
  };

  const extractEmailAddresses = (attendees, stakeholders, accountUrl, accountName) => {
    const emails = [];
    attendees.forEach(attendee => {
      const emailMatch = attendee.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        emails.push(emailMatch[1]);
      } else {
        const attendeeName = attendee.split('(')[0].trim();
        if (attendee.toLowerCase().includes('banner') || attendee.toLowerCase().includes('james')) return;
        const stakeholder = stakeholders?.find(s => {
          const sName = s.name?.toLowerCase() || '';
          const aName = attendeeName.toLowerCase();
          return sName === aName || sName.includes(aName) || aName.includes(sName);
        });
        emails.push(generateEmailFromName(stakeholder?.name || attendeeName, accountUrl, accountName));
      }
    });
    return [...new Set(emails)];
  };

  const handleSendToGmail = async () => {
    const subjectMatch = editedEmail.match(/Subject:\s*(.+?)(\n|$)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'Banner Follow Up';
    let bodyWithoutSubject = editedEmail.replace(/Subject:.*?\n\n?/, '').trim();
    if (bodyWithoutSubject.includes('Attaching:') || bodyWithoutSubject.includes('Sending you:')) {
      bodyWithoutSubject = '📎 Note: Please attach the items listed below before sending.\n\n' + bodyWithoutSubject;
    }
    const recipientEmails = extractEmailAddresses(transcript.attendees || [], account.stakeholders || [], account.url, account.name);
    if (recipientEmails.length === 0) bodyWithoutSubject = '⚠️ No email addresses found - please add recipients manually.\n\n' + bodyWithoutSubject;
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    if (recipientEmails.length > 0) gmailUrl.searchParams.set('to', recipientEmails.join(','));
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', bodyWithoutSubject);
    if (originalContent.email !== editedEmail) await saveEmailEdit(originalContent.email, editedEmail, transcript, account);
    window.open(gmailUrl.toString(), '_blank');
  };

  const saveEmailEdit = async (original, edited, transcript, account) => {
    try {
      await fetch('/api/save-email-edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original, edited, transcriptId: transcript.id, accountId: account.id, accountName: account.name, callType: transcript.callType, timestamp: new Date().toISOString() })
      });
    } catch {}
  };

  const handleGenerateAgenda = async () => {
    setGenerating('agenda');
    try {
      const response = await fetch('/api/generate-agenda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, account }) });
      const data = await response.json();
      if (data.content) setGeneratedContent(prev => ({ ...prev, agenda: data.content }));
    } catch {}
    finally { setGenerating(null); }
  };

  const handleGenerateFeedback = async () => {
    setGenerating('feedback');
    try {
      const response = await fetch('/api/generate-coaching-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, account }) });
      const data = await response.json();
      if (data.content) setGeneratedContent(prev => ({ ...prev, feedback: data.content }));
    } catch {}
    finally { setGenerating(null); }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${callType.color}`}>{callType.label}</span>
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />{transcript.date || 'Unknown date'}
              </span>
            </div>
            {attendees.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Users className="w-4 h-4" /><span>{attendees.join(', ')}</span>
              </div>
            )}
            <p className="text-sm text-gray-700">{transcript.summary || 'No summary available'}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-500 hover:text-gray-700">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
        {nextSteps.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs font-medium text-gray-500 mb-1">Next Steps:</div>
            <ul className="text-sm space-y-1">
              {nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" /><span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="p-3 flex gap-2 flex-wrap">
        {transcript.gongUrl && (
          <a href={transcript.gongUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
            <ExternalLink className="w-4 h-4" />Review in Gong
          </a>
        )}
        <button onClick={handleGenerateEmail} disabled={generating === 'email'}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
          {generating === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Follow-up Email
        </button>
        <button onClick={handleGenerateAgenda} disabled={generating === 'agenda'}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
          {generating === 'agenda' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Next Meeting Agenda
        </button>
        <button onClick={handleGenerateFeedback} disabled={generating === 'feedback'}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
          {generating === 'feedback' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          Sales Coaching
        </button>
      </div>
      {(generatedContent.email || generatedContent.agenda || generatedContent.feedback) && (
        <div className="p-4 border-t bg-blue-50 space-y-4">
          {generatedContent.email && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Follow-up Email</span>
                  {detectedStage && STAGE_CONFIG[detectedStage] && (
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STAGE_CONFIG[detectedStage].color}`}>
                      <Tag className="w-3 h-3" />{STAGE_CONFIG[detectedStage].label}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(editedEmail)} className="text-xs text-blue-600 hover:text-blue-700">Copy</button>
                  <button onClick={handleSendToGmail} className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                    <Mail className="w-3 h-3" />Send to Gmail
                  </button>
                </div>
              </div>
              <textarea value={editedEmail} onChange={e => setEditedEmail(e.target.value)}
                className="w-full text-sm font-mono bg-white p-3 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500" rows={15} style={{ resize: 'vertical' }} />
              {originalContent.email !== editedEmail && <div className="text-xs text-gray-500 mt-1">✏️ Edited - Changes will be learned for future emails</div>}
            </div>
          )}
          {generatedContent.agenda && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Meeting Agenda</span>
                <button onClick={() => navigator.clipboard.writeText(generatedContent.agenda)} className="text-xs text-blue-600 hover:text-blue-700">Copy</button>
              </div>
              <pre className="text-sm whitespace-pre-wrap bg-white p-3 rounded border">{generatedContent.agenda}</pre>
            </div>
          )}
          {generatedContent.feedback && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Sales Coaching Feedback</span>
                <button onClick={() => navigator.clipboard.writeText(generatedContent.feedback)} className="text-xs text-blue-600 hover:text-blue-700">Copy</button>
              </div>
              <div className="text-sm whitespace-pre-wrap bg-white p-3 rounded border">{generatedContent.feedback}</div>
            </div>
          )}
        </div>
      )}
      {expanded && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-gray-500">Full Transcript</div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Rep</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Prospect</span>
            </div>
          </div>
          <div className="bg-white p-3 rounded border"><AnnotatedTranscript transcript={transcript} /></div>
        </div>
      )}
    </div>
  );
};

// ── Main tab ───────────────────────────────────────────────────────────────────
const DEFAULT_SHOW = 5;

const TranscriptsTab = ({ account, onOpenTranscriptModal }) => {
  const [gongCalls, setGongCalls] = useState([])
  const [gongLoading, setGongLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!account?.id) return
    setGongLoading(true)
    fetch(`/api/gong/account-calls?accountId=${account.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setGongCalls(d.calls || []) })
      .catch(() => {})
      .finally(() => setGongLoading(false))
  }, [account?.id])

  const manualTranscripts = account?.transcripts || []
  const totalCalls = gongCalls.length + manualTranscripts.length
  const visibleGong = showAll ? gongCalls : gongCalls.slice(0, Math.max(0, DEFAULT_SHOW - manualTranscripts.length))
  const needsAttentionCount = gongCalls.filter(c => c.attentionScore >= 40).length

  return (
    <div className="space-y-4">
      {/* Header row */}
      {totalCalls > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{totalCalls} call{totalCalls !== 1 ? 's' : ''} total</span>
            {gongCalls.length > 0 && (
              <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                {gongCalls.length} auto-linked
              </span>
            )}
            {needsAttentionCount > 0 && (
              <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{needsAttentionCount} need attention
              </span>
            )}
          </div>
          <button
            onClick={onOpenTranscriptModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Upload className="w-4 h-4" />Add Transcript
          </button>
        </div>
      )}

      {/* Gong-analyzed calls */}
      {gongLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
          <Loader2 className="w-4 h-4 animate-spin" />Loading AI-analyzed calls…
        </div>
      )}

      {!gongLoading && gongCalls.length > 0 && (
        <>
          {visibleGong.map(call => (
            <GongCallCard key={call.id} call={call} />
          ))}
        </>
      )}

      {/* Manual transcripts */}
      {manualTranscripts.map(t => (
        <TranscriptCard key={t.id} transcript={t} account={account} />
      ))}

      {/* Show all / empty state */}
      {!showAll && gongCalls.length > DEFAULT_SHOW && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Show {gongCalls.length - visibleGong.length} more calls
        </button>
      )}

      {totalCalls === 0 && !gongLoading && (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">No calls yet.</div>
          <button
            onClick={onOpenTranscriptModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mx-auto"
          >
            <Upload className="w-4 h-4" />Add Transcript
          </button>
        </div>
      )}
    </div>
  );
};

export default TranscriptsTab;
