import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Check, ExternalLink } from 'lucide-react';

const GongCallList = ({ onSelectCall, onImportComplete }) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(null);

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const response = await fetch('/api/gong/list-calls?days=30');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch calls');
      }

      setCalls(data.calls || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (call) => {
    setImporting(call.id);
    try {
      const response = await fetch('/api/gong/import-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: call.id })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import call');
      }

      onImportComplete(data.call);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(null);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading Gong calls...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">{error}</div>
        {error.includes('not configured') && (
          <div className="text-sm text-gray-500">
            Add GONG_ACCESS_KEY and GONG_SECRET_KEY to your environment variables.
          </div>
        )}
        <button
          onClick={fetchCalls}
          className="mt-4 px-4 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No calls found in the last 30 days.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {calls.map(call => (
        <div
          key={call.id}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{call.title || 'Untitled Call'}</div>
            <div className="text-sm text-gray-500 flex items-center gap-3">
              <span>{formatDate(call.date)}</span>
              <span>{formatDuration(call.duration)}</span>
              {call.parties?.length > 0 && (
                <span>{call.parties.length} participants</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {call.url && (
              <a
                href={call.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-gray-600"
                title="View in Gong"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => handleImport(call)}
              disabled={importing === call.id}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {importing === call.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const NewTranscriptModal = ({
  transcriptText,
  setTranscriptText,
  onClose,
  onAdd,
  onAddGongTranscript,
  isProcessing
}) => {
  const [activeTab, setActiveTab] = useState('paste');

  const handleGongImport = (gongCall) => {
    // If parent provided a Gong-specific handler, use it
    if (onAddGongTranscript) {
      onAddGongTranscript(gongCall);
    } else {
      // Otherwise, set the transcript text and let parent process it
      setTranscriptText(gongCall.transcript);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Transcript</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            onClick={() => setActiveTab('paste')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Paste Transcript
          </button>
          <button
            onClick={() => setActiveTab('gong')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'gong'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Import from Gong
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'paste' ? (
          <>
            <div>
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                rows={12}
                className="w-full border rounded p-2 font-mono text-sm select-text cursor-text"
                placeholder="Paste call transcript here..."
                autoFocus
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onAdd}
                disabled={isProcessing || !transcriptText.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Process'}
              </button>
            </div>
          </>
        ) : (
          <>
            <GongCallList onImportComplete={handleGongImport} />
            <div className="flex justify-end mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewTranscriptModal;
