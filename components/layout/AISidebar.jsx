import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronRight, Sparkles } from 'lucide-react';

// Context-aware suggested prompts based on current tab
const SUGGESTED_PROMPTS = {
  overview: [
    "What's the current deal status?",
    "Update the stage to Solution Validation",
    "Set the vertical to Multifamily",
    "What should I focus on next?",
  ],
  transcripts: [
    "Summarize our last call",
    "What were the key takeaways?",
    "Who was on the most recent call?",
  ],
  current_state: [
    "Mark CM Fees as not relevant",
    "What areas still need discovery?",
    "They use Yardi for invoicing",
  ],
  stakeholders: [
    "John is the champion",
    "Who is the economic buyer?",
    "Sarah should be marked as blocker",
  ],
  gaps: [
    "Ignore the pricing timeline gap",
    "Add gap: need to understand approval workflow",
    "What are the most critical gaps?",
  ],
  content: [
    "Generate a business case",
    "What info do I need before generating content?",
    "Create a 1-pager for this account",
  ],
};

const AISidebar = ({ isOpen, onToggle, account, activeTab, onApplyActions }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setPendingActions(null);

    try {
      const response = await fetch('/api/account-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          account,
          context: { activeTab }
        })
      });

      // Handle empty or invalid responses
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        throw new Error(`Invalid response from server: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        actions: data.actions,
      }]);

      if (data.actions?.length > 0) {
        setPendingActions(data.actions);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: error.message
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (pendingActions && onApplyActions) {
      onApplyActions(pendingActions);
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Changes applied successfully.'
      }]);
      setPendingActions(null);
    }
  };

  const handleCancel = () => {
    setPendingActions(null);
    setMessages(prev => [...prev, {
      role: 'system',
      content: 'Changes cancelled.'
    }]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const suggestedPrompts = SUGGESTED_PROMPTS[activeTab] || SUGGESTED_PROMPTS.overview;

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-50 transition-transform hover:scale-105"
        title="Open AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col border-l">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <div>
            <h2 className="font-semibold">AI Assistant</h2>
            <p className="text-xs text-blue-100">{account?.name || 'No account selected'}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-blue-500 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-blue-200" />
            <p className="text-gray-600 mb-4">
              Ask questions or make updates using natural language
            </p>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-2">Try saying:</p>
              {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="block w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
                >
                  <ChevronRight className="w-3 h-3 inline mr-1 text-gray-400" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.role === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : msg.role === 'system'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Show pending actions */}
              {msg.actions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium mb-1">Proposed changes:</p>
                  <ul className="text-xs space-y-1">
                    {msg.actions.map((action, j) => (
                      <li key={j} className="flex items-center gap-1">
                        <span className="text-blue-500">•</span>
                        {action.type === 'update_stakeholder_role' && (
                          <span>Set {action.name}'s role to {action.newRole}</span>
                        )}
                        {action.type === 'add_metric' && (
                          <span>Set {action.metric} to {action.value}</span>
                        )}
                        {action.type === 'add_note' && (
                          <span>Add note: {action.content}</span>
                        )}
                        {action.type === 'mark_area_irrelevant' && (
                          <span>Mark {action.areaId} as not applicable</span>
                        )}
                        {action.type === 'update_stage' && (
                          <span>Update stage to {action.stage}</span>
                        )}
                        {action.type === 'update_vertical' && (
                          <span>Set vertical to {action.vertical}</span>
                        )}
                        {action.type === 'update_ownership' && (
                          <span>Set ownership to {action.ownership}</span>
                        )}
                        {action.type === 'resolve_gap' && (
                          <span>Resolve gap: {action.gapId}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Confirmation buttons */}
      {pendingActions && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700">Apply these changes?</span>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Suggested prompts bar */}
      {messages.length > 0 && !pendingActions && (
        <div className="px-4 py-2 border-t bg-gray-50 flex gap-2 overflow-x-auto">
          {suggestedPrompts.slice(0, 2).map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSuggestedPrompt(prompt)}
              className="text-xs px-2 py-1 bg-white border rounded-full hover:bg-gray-100 whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask or update..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISidebar;
