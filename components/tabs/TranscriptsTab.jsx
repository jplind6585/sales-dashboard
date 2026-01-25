import { Upload } from 'lucide-react';

const TranscriptsTab = ({ account, onOpenTranscriptModal }) => (
  <div className="space-y-4">
    {account.transcripts && account.transcripts.length > 0 ? (
      <>
        {account.transcripts.map(t => (
          <div key={t.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium">{t.date}</div>
            </div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {t.analysis || t.text.substring(0, 200) + '...'}
            </div>
          </div>
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
