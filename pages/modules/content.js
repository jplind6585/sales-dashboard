import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  ArrowLeft,
  FileText,
  Presentation,
  Puzzle,
  Download,
  Eye,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function ContentModule() {
  const router = useRouter()
  const [accounts, setAccounts] = useState([])
  const [templates, setTemplates] = useState([])

  // Form state
  const [selectedContentType, setSelectedContentType] = useState('1-pager')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [customInputs, setCustomInputs] = useState({})

  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [previewContent, setPreviewContent] = useState(null)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [error, setError] = useState(null)

  // Load accounts on mount
  useEffect(() => {
    loadAccounts()
    loadTemplates()
  }, [])

  // Load templates when content type changes
  useEffect(() => {
    if (selectedContentType) {
      loadTemplates()
    }
  }, [selectedContentType])

  const loadAccounts = () => {
    // Load from localStorage for now
    const stored = localStorage.getItem('accounts')
    if (stored) {
      const parsed = JSON.parse(stored)
      setAccounts(parsed)
    }
  }

  const loadTemplates = async () => {
    // TODO: Load from API once database is set up
    // For now, hardcode based on content type
    const templatesByType = {
      '1-pager': [
        { id: '1', name: 'Enterprise 1-Pager', version: 'enterprise' },
        { id: '2', name: 'Mid-Market 1-Pager', version: 'mid-market' },
        { id: '3', name: 'Case Study', version: 'case-study' },
        { id: '4', name: 'ROI-Focused 1-Pager', version: 'roi-focused' }
      ],
      'sales-deck': [
        { id: '5', name: 'Intro Deck', version: 'intro' },
        { id: '6', name: 'Demo/Follow-up Deck', version: 'demo' },
        { id: '7', name: 'Proposal Deck', version: 'proposal' }
      ],
      'integration-guide': [
        { id: '8', name: 'Yardi Integration', version: '1-pager', category: 'yardi' },
        { id: '9', name: 'MRI Integration', version: '1-pager', category: 'mri' },
        { id: '10', name: 'Real Page Integration', version: '1-pager', category: 'realpage' },
        { id: '11', name: 'Appfolio Integration', version: '1-pager', category: 'appfolio' },
        { id: '12', name: 'Resman Integration', version: '1-pager', category: 'resman' },
        { id: '13', name: 'Entrata Integration', version: '1-pager', category: 'entrata' },
        { id: '14', name: 'Oracle Integration', version: '1-pager', category: 'oracle' },
        { id: '15', name: 'Sage Integration', version: '1-pager', category: 'sage' }
      ]
    }

    setTemplates(templatesByType[selectedContentType] || [])
    setSelectedTemplate(null)
  }

  const handleGeneratePreview = async () => {
    if (!selectedAccount || !selectedTemplate) {
      setError('Please select an account and template')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // TODO: Call API to generate preview
      // For now, simulate with timeout
      await new Promise(resolve => setTimeout(resolve, 1500))

      setPreviewContent({
        title: `${selectedTemplate.name} - ${selectedAccount.name}`,
        type: selectedContentType,
        template: selectedTemplate.name,
        account: selectedAccount.name,
        generatedAt: new Date().toISOString()
      })
    } catch (err) {
      setError('Failed to generate preview: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportToDrive = async () => {
    if (!previewContent) {
      setError('Please generate a preview first')
      return
    }

    setIsExporting(true)
    setError(null)
    setExportSuccess(false)

    try {
      // TODO: Call API to export to Google Drive
      await new Promise(resolve => setTimeout(resolve, 2000))

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err) {
      setError('Failed to export to Drive: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const contentTypes = [
    { id: '1-pager', name: '1-Pagers', icon: FileText, description: 'Single page overviews and case studies' },
    { id: 'sales-deck', name: 'Sales Decks', icon: Presentation, description: 'Presentation slides for meetings' },
    { id: 'integration-guide', name: 'Integration Guides', icon: Puzzle, description: 'Tech partner integration docs' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/modules')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Content Generator</h1>
                <p className="text-sm text-gray-600">Create client-ready materials with Google Drive integration</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">◐</span>
              <span className="text-sm font-medium text-amber-600">In Progress</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 gap-6 h-[calc(100vh-180px)]">
          {/* Left Panel - Configuration */}
          <div className="bg-white rounded-xl shadow-sm border p-6 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-6">Configure Content</h2>

            {/* Content Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Content Type
              </label>
              <div className="grid grid-cols-1 gap-3">
                {contentTypes.map(type => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedContentType(type.id)}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        selectedContentType === type.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 ${
                        selectedContentType === type.id ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div>
                        <div className="font-medium text-gray-900">{type.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Template Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Version
              </label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => {
                  const template = templates.find(t => t.id === e.target.value)
                  setSelectedTemplate(template)
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client/Account
              </label>
              <select
                value={selectedAccount?.id || ''}
                onChange={(e) => {
                  const account = accounts.find(a => a.id === e.target.value)
                  setSelectedAccount(account)
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an account...</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Inputs (Future) */}
            {selectedAccount && selectedTemplate && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Details
                </label>
                <textarea
                  placeholder="Add any custom information to include in the content..."
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={customInputs.notes || ''}
                  onChange={(e) => setCustomInputs({ ...customInputs, notes: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-2">
                  This will be combined with account data, transcripts, and MEDDICC information
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGeneratePreview}
              disabled={!selectedAccount || !selectedTemplate || isGenerating}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5" />
                  Generate Preview
                </>
              )}
            </button>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white rounded-xl shadow-sm border p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Preview</h2>
              {previewContent && (
                <button
                  onClick={handleExportToDrive}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : exportSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Exported!
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export to Drive
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Preview Content */}
            {!previewContent ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <Eye className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Preview Yet
                </h3>
                <p className="text-gray-600 max-w-md">
                  Select a content type, template, and account, then click "Generate Preview" to see your content
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Preview Header */}
                <div className="border-b pb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {previewContent.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Type: {previewContent.type}</span>
                    <span>•</span>
                    <span>Template: {previewContent.template}</span>
                    <span>•</span>
                    <span>Generated: {new Date(previewContent.generatedAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Preview Body - Placeholder */}
                <div className="prose max-w-none">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      🚧 Preview Under Construction
                    </p>
                    <p className="text-sm text-blue-800">
                      This preview will show formatted content based on your selected template and account data.
                      The actual template engine is being built next!
                    </p>
                  </div>

                  <h2>Account Overview</h2>
                  <p><strong>Company:</strong> {previewContent.account}</p>

                  <h2>Value Proposition</h2>
                  <p>Customized value proposition will appear here based on account data...</p>

                  <h2>Pain Points Addressed</h2>
                  <ul>
                    <li>Pain point from transcripts...</li>
                    <li>Another pain point...</li>
                  </ul>

                  <h2>Solution Overview</h2>
                  <p>Solution details based on template...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
