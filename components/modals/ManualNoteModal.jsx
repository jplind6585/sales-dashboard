import { X } from 'lucide-react';

const ManualNoteModal = ({
  manualNote,
  setManualNote,
  onClose,
  onAdd
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Manual Note</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Note</label>
          <textarea
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            rows={4}
            className="w-full border rounded p-2"
            placeholder="e.g., John Smalley is the champion"
          />
        </div>
        <p className="text-xs text-gray-500">
          Examples: "Terri is the champion", "Budget is $500K", "They don't do CM fees"
        </p>
      </div>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onAdd}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Note
        </button>
      </div>
    </div>
  </div>
);

export default ManualNoteModal;
