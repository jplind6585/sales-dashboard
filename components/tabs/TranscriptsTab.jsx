import { useState } from 'react';
import { Upload, Calendar, Users, ArrowRight, ExternalLink, Mail, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const CALL_TYPES = [
  { id: 'intro', label: 'Intro Call', color: 'bg-blue-100 text-blue-700' },
  { id: 'discovery', label: 'Discovery', color: 'bg-purple-100 text-purple-700' },
  { id: 'demo', label: 'Demo', color: 'bg-green-100 text-green-700' },
  { id: 'pricing', label: 'Pricing', color: 'bg-amber-100 text-amber-700' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  { id: 'follow_up', label: 'Follow-up', color: 'bg-gray-100 text-gray-700' },
  { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700' }
];

const TranscriptCard = ({ transcript, account, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [generatedContent, setGeneratedContent] = useState({ email: null, agenda: null });

  const callType = CALL_TYPES.find(t => t.id === transcript.callType) || CALL_TYPES[CALL_TYPES.length - 1];
  const attendees = transcript.attendees || [];
  const nextSteps = transcript.rawAnalysis?.nextSteps || [];

  const handleGenerateEmail = async () => {
    setGenerating('email');
    try {
      const response = await fetch('/api/generate-follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, account })
      });
      const data = await response.json();
      if (data.content) {
        setGeneratedContent(prev => ({ ...prev, email: data.content }));
      }
    } catch (err) {
      console.error('Error generating email:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateAgenda = async () => {
    setGenerating('agenda');
    try {
      const response = await fetch('/api/generate-agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, account })
      });
      const data = await response.json();
      if (data.content) {
        setGeneratedContent(prev => ({ ...prev, agenda: data.content }));
      }
    } catch (err) {
      console.error('Error generating agenda:', err);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${callType.color}`}>
                {callType.label}
              </span>
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                {transcript.date || 'Unknown date'}
              </span>
            </div>

            {/* Attendees */}
            {attendees.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Users className="w-4 h-4" />
                <span>{attendees.join(', ')}</span>
              </div>
            )}

            {/* Summary */}
            <p className="text-sm text-gray-700">{transcript.summary || 'No summary available'}</p>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Next Steps */}
        {nextSteps.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs font-medium text-gray-500 mb-1">Next Steps:</div>
            <ul className="text-sm space-y-1">
              {nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3 flex gap-2 flex-wrap">
        {transcript.gongUrl && (
          <a
            href={transcript.gongUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4" />
            Review in Gong
          </a>
        )}
        <button
          onClick={handleGenerateEmail}
          disabled={generating === 'email'}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {generating === 'email' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          Follow-up Email
        </button>
        <button
          onClick={handleGenerateAgenda}
          disabled={generating === 'agenda'}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {generating === 'agenda' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Next Meeting Agenda
        </button>
      </div>

      {/* Generated Content */}
      {(generatedContent.email || generatedContent.agenda) && (
        <div className="p-4 border-t bg-blue-50 space-y-4">
          {generatedContent.email && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Follow-up Email</span>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent.email)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Copy
                </button>
              </div>
              <pre className="text-sm whitespace-pre-wrap bg-white p-3 rounded border">
                {generatedContent.email}
              </pre>
            </div>
          )}
          {generatedContent.agenda && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Meeting Agenda</span>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent.agenda)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Copy
                </button>
              </div>
              <pre className="text-sm whitespace-pre-wrap bg-white p-3 rounded border">
                {generatedContent.agenda}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 border-t bg-gray-50">
          <div className="text-xs font-medium text-gray-500 mb-2">Full Transcript</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto bg-white p-3 rounded border">
            {transcript.text}
          </div>
        </div>
      )}
    </div>
  );
};

const TranscriptsTab = ({ account, onOpenTranscriptModal }) => (
  <div className="space-y-4">
    {account.transcripts && account.transcripts.length > 0 ? (
      <>
        {account.transcripts.map(t => (
          <TranscriptCard key={t.id} transcript={t} account={account} />
        ))}
        <div className="flex justify-end pt-4">
          <button
            onClick={onOpenTranscriptModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Upload className="w-4 h-4" />
            Add Transcript
          </button>
        </div>
      </>
    ) : (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">No transcripts yet.</div>
        <button
          onClick={onOpenTranscriptModal}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mx-auto"
        >
          <Upload className="w-4 h-4" />
          Add Transcript
        </button>
      </div>
    )}
  </div>
);

export default TranscriptsTab;
