import { useState } from 'react';
import { FileText, Download, Loader2, CheckCircle } from 'lucide-react';
import { BUSINESS_AREAS, KEY_METRICS } from '../../lib/constants';

const ContentTab = ({ account }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [error, setError] = useState(null);

  // Calculate readiness
  const businessAreas = account?.businessAreas || {};
  const areasWithData = BUSINESS_AREAS.filter(area => {
    const data = businessAreas[area.id];
    return data?.currentState?.length > 0 || data?.opportunities?.length > 0;
  }).length;

  const metrics = account?.metrics || {};
  const metricsWithData = KEY_METRICS.filter(m => metrics[m.id]?.value).length;

  const stakeholders = account?.stakeholders || [];
  const hasChampion = stakeholders.some(s => s.role === 'Champion');
  const hasEconomicBuyer = stakeholders.some(s => s.role === 'Economic Buyer');

  const readinessScore = Math.round(
    ((areasWithData / 16) * 40) +
    ((metricsWithData / 10) * 30) +
    (hasChampion ? 15 : 0) +
    (hasEconomicBuyer ? 15 : 0)
  );

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-business-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate business case');
      }

      const data = await response.json();
      setGeneratedContent(data.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Readiness Score */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Business Case Readiness</h3>
          <span className={`text-2xl font-bold ${
            readinessScore >= 70 ? 'text-green-600' :
            readinessScore >= 40 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {readinessScore}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full transition-all ${
              readinessScore >= 70 ? 'bg-green-500' :
              readinessScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${readinessScore}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${areasWithData >= 8 ? 'text-green-500' : 'text-gray-300'}`} />
            <span>Business Areas: {areasWithData}/16</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${metricsWithData >= 5 ? 'text-green-500' : 'text-gray-300'}`} />
            <span>Key Metrics: {metricsWithData}/10</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${hasChampion ? 'text-green-500' : 'text-gray-300'}`} />
            <span>Champion: {hasChampion ? 'Identified' : 'Needed'}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${hasEconomicBuyer ? 'text-green-500' : 'text-gray-300'}`} />
            <span>Economic Buyer: {hasEconomicBuyer ? 'Identified' : 'Needed'}</span>
          </div>
        </div>
      </div>

      {/* Generate Section */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Generate Business Case</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create a business case document based on all captured information about {account?.name || 'this account'}.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isGenerating || readinessScore < 20}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Generate Business Case
            </>
          )}
        </button>

        {readinessScore < 20 && (
          <p className="text-sm text-gray-500 mt-2">
            Add more transcript data to enable business case generation.
          </p>
        )}
      </div>

      {/* Generated Content */}
      {generatedContent && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Generated Business Case</h3>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(generatedContent)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 px-2 py-1 border rounded"
              >
                Copy
              </button>
              <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 px-2 py-1 border rounded">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
          <div
            className="prose prose-sm max-w-none bg-gray-50 p-4 rounded overflow-auto"
            style={{ maxHeight: '600px' }}
            dangerouslySetInnerHTML={{
              __html: generatedContent
                .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3 border-b pb-2">$1</h2>')
                .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
                .replace(/^\- (.+)$/gm, '<li class="ml-4">$1</li>')
                .replace(/^\* (.+)$/gm, '<li class="ml-4">$1</li>')
                .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-blue-300 pl-4 italic text-gray-600 my-2">$1</blockquote>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n\n/g, '</p><p class="my-2">')
                .replace(/^(.+)$/gm, (match) => {
                  if (match.startsWith('<')) return match;
                  return match;
                })
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ContentTab;
