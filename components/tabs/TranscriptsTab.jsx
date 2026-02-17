import { useState } from 'react';
import { Upload, Calendar, Users, ArrowRight, ExternalLink, Mail, FileText, Loader2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

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
  const [generatedContent, setGeneratedContent] = useState({ email: null, agenda: null, feedback: null });
  const [originalContent, setOriginalContent] = useState({ email: null }); // Track original for learning
  const [editedEmail, setEditedEmail] = useState(''); // Track edited version

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
        setOriginalContent(prev => ({ ...prev, email: data.content })); // Save original for learning
        setEditedEmail(data.content); // Initialize edited version
      }
    } catch (err) {
      console.error('Error generating email:', err);
    } finally {
      setGenerating(null);
    }
  };

  const generateEmailFromName = (name, accountUrl, accountName) => {
    // Generate email from name and account domain
    // "Sarah Chen" + "prometheus.com" → "sarah.chen@prometheus.com"

    // Extract domain from account URL
    let domain = '';
    if (accountUrl) {
      try {
        const url = new URL(accountUrl.startsWith('http') ? accountUrl : `https://${accountUrl}`);
        domain = url.hostname.replace('www.', '');
      } catch (e) {
        // If URL parsing fails, use account name
        domain = accountName?.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
      }
    } else {
      domain = accountName?.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    }

    // Convert name to email format: "Sarah Chen" → "sarah.chen"
    const emailPrefix = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
      .split(/\s+/)
      .join('.');

    return `${emailPrefix}@${domain}`;
  };

  const extractEmailAddresses = (attendees, stakeholders, accountUrl, accountName) => {
    // Extract email addresses from attendee strings
    // Format can be "Name (email)" or just "Name" or "Name <email>"
    const emails = [];

    // Try to get from attendees first
    attendees.forEach(attendee => {
      const emailMatch = attendee.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        emails.push(emailMatch[1]);
      } else {
        // Extract name from attendee string (e.g., "Sarah Chen (Prometheus)" → "Sarah Chen")
        const attendeeName = attendee.split('(')[0].trim();

        // Skip Banner employees
        if (attendee.toLowerCase().includes('banner') || attendee.toLowerCase().includes('james')) {
          return;
        }

        // Try to match with stakeholder by name
        const stakeholder = stakeholders?.find(s => {
          const sName = s.name?.toLowerCase() || '';
          const aName = attendeeName.toLowerCase();
          return sName === aName || sName.includes(aName) || aName.includes(sName);
        });

        // Generate email from name and account domain
        const email = generateEmailFromName(stakeholder?.name || attendeeName, accountUrl, accountName);
        emails.push(email);
      }
    });

    // Remove duplicates
    return [...new Set(emails)];
  };

  const handleSendToGmail = async () => {
    // Extract subject line from email content
    const subjectMatch = editedEmail.match(/Subject:\s*(.+?)(\n|$)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'Banner Follow Up';

    // Remove subject line from body
    let bodyWithoutSubject = editedEmail.replace(/Subject:.*?\n\n?/, '').trim();

    // Add note about attachments at the top of body if there's an "Attaching:" section
    if (bodyWithoutSubject.includes('Attaching:') || bodyWithoutSubject.includes('Sending you:')) {
      bodyWithoutSubject = '📎 Note: Please attach the items listed below before sending.\n\n' + bodyWithoutSubject;
    }

    // Get recipient emails
    const recipientEmails = extractEmailAddresses(transcript.attendees || [], account.stakeholders || [], account.url, account.name);

    // If no emails found, add note to body
    if (recipientEmails.length === 0) {
      bodyWithoutSubject = '⚠️ No email addresses found - please add recipients manually.\n\n' + bodyWithoutSubject;
    }

    // Construct Gmail URL
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    if (recipientEmails.length > 0) {
      gmailUrl.searchParams.set('to', recipientEmails.join(','));
    }
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', bodyWithoutSubject);

    // Save the edit for learning before opening Gmail
    if (originalContent.email !== editedEmail) {
      await saveEmailEdit(originalContent.email, editedEmail, transcript, account);
    }

    // Open Gmail in new window
    window.open(gmailUrl.toString(), '_blank');
  };

  const saveEmailEdit = async (original, edited, transcript, account) => {
    try {
      await fetch('/api/save-email-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original,
          edited,
          transcriptId: transcript.id,
          accountId: account.id,
          accountName: account.name,
          callType: transcript.callType,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.error('Error saving email edit:', err);
      // Don't block the Gmail send on error
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

  const handleGenerateFeedback = async () => {
    setGenerating('feedback');
    try {
      const response = await fetch('/api/generate-coaching-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, account })
      });
      const data = await response.json();
      if (data.content) {
        setGeneratedContent(prev => ({ ...prev, feedback: data.content }));
      }
    } catch (err) {
      console.error('Error generating feedback:', err);
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
        <button
          onClick={handleGenerateFeedback}
          disabled={generating === 'feedback'}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {generating === 'feedback' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
          Sales Coaching
        </button>
      </div>

      {/* Generated Content */}
      {(generatedContent.email || generatedContent.agenda || generatedContent.feedback) && (
        <div className="p-4 border-t bg-blue-50 space-y-4">
          {generatedContent.email && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Follow-up Email</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(editedEmail)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleSendToGmail}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Mail className="w-3 h-3" />
                    Send to Gmail
                  </button>
                </div>
              </div>
              <textarea
                value={editedEmail}
                onChange={(e) => setEditedEmail(e.target.value)}
                className="w-full text-sm font-mono bg-white p-3 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={15}
                style={{ resize: 'vertical' }}
              />
              {originalContent.email !== editedEmail && (
                <div className="text-xs text-gray-500 mt-1">
                  ✏️ Edited - Changes will be learned for future emails
                </div>
              )}
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
          {generatedContent.feedback && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Sales Coaching Feedback</span>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent.feedback)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Copy
                </button>
              </div>
              <div className="text-sm whitespace-pre-wrap bg-white p-3 rounded border">
                {generatedContent.feedback}
              </div>
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
