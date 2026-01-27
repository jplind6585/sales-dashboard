import { useState, useEffect, useCallback } from 'react';
import { X, Upload, Loader2, Check, ExternalLink, Search, User, Calendar, Filter, ChevronDown } from 'lucide-react';

const GongCallList = ({ onSelectCall, onImportComplete }) => {
  const [calls, setCalls] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchCalls = useCallback(async (search = '', userId = '', from = '', to = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: '90' });
      if (search) params.set('search', search);
      if (userId) params.set('userId', userId);
      if (from) params.set('fromDate', from);
      if (to) params.set('toDate', to);

      const response = await fetch(`/api/gong/list-calls?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch calls');
      }

      setCalls(data.calls || []);
      // Only update users list on initial load (not when filtering by user)
      if (!userId && data.users?.length > 0) {
        setUsers(data.users);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls(debouncedSearch, selectedUserId, fromDate, toDate);
  }, [debouncedSearch, selectedUserId, fromDate, toDate, fetchCalls]);

  const clearFilters = () => {
    setSelectedUserId('');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedUserId || fromDate || toDate;

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

  if (error && !loading) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">{error}</div>
        {error.includes('not configured') && (
          <div className="text-sm text-gray-500">
            Add GONG_ACCESS_KEY and GONG_SECRET_KEY to your environment variables.
          </div>
        )}
        <button
          onClick={() => fetchCalls(debouncedSearch)}
          className="mt-4 px-4 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and Filter Row */}
      <div className="flex gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, user, or participant..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 border rounded-lg text-sm flex items-center gap-1 transition-colors ${
            hasActiveFilters
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {(selectedUserId ? 1 : 0) + (fromDate || toDate ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-3 bg-gray-50 rounded-lg border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Rep Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Banner Rep</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All reps</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading Gong calls...</span>
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? (
            <>
              <div>No calls matching "{searchQuery}"</div>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                Clear search
              </button>
            </>
          ) : (
            'No calls found in the last 90 days.'
          )}
        </div>
      ) : (
        <>
          {/* Results count */}
          <div className="text-xs text-gray-500 px-1">
            {calls.length} call{calls.length !== 1 ? 's' : ''} found
            {searchQuery && ` for "${searchQuery}"`}
            {hasActiveFilters && !searchQuery && ' (filtered)'}
          </div>

          {/* Call List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {calls.map(call => (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{call.title || 'Untitled Call'}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 flex-wrap">
                    <span>{formatDate(call.date)}</span>
                    <span>{formatDuration(call.duration)}</span>
                    {call.user?.name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {call.user.name}
                      </span>
                    )}
                    {call.parties?.length > 0 && (
                      <span className="text-gray-400">
                        {call.parties.length} participant{call.parties.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {/* Show external participants */}
                  {call.parties?.filter(p => p.affiliation === 'external').length > 0 && (
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      External: {call.parties
                        .filter(p => p.affiliation === 'external')
                        .map(p => p.name || p.emailAddress)
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(', ')}
                      {call.parties.filter(p => p.affiliation === 'external').length > 3 && '...'}
                    </div>
                  )}
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
        </>
      )}
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
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
        <div className="flex-1 overflow-auto">
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
              <div className="flex justify-end mt-4 pt-4 border-t">
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
    </div>
  );
};

export default NewTranscriptModal;
