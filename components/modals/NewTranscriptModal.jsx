import { X } from 'lucide-react';

const NewTranscriptModal = ({
  transcriptText,
  setTranscriptText,
  onClose,
  onAdd,
  isProcessing
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Transcript</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>
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
    </div>
  </div>
);

export default NewTranscriptModal;
