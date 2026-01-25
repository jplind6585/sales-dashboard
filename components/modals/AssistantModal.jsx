import { useState } from 'react';
import { X, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const AssistantModal = ({ account, onClose, onApplyActions }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);

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
        body: JSON.stringify({ message: userMessage, account })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        actions: data.actions,
        needsConfirmation: data.needsConfirmation
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-lg font-bold">Account Assistant</h2>
            <p className="text-sm text-gray-500">{account?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: '300px' }}>
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="mb-2">Ask questions or make updates:</p>
              <div className="text-sm space-y-1">
                <p className="text-gray-400">"John is the champion"</p>
                <p className="text-gray-400">"CM fee rate is 5%"</p>
                <p className="text-gray-400">"What did we discuss about pricing?"</p>
                <p className="text-gray-400">"Who was on the last call?"</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
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
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" />
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
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
    </div>
  );
};

export default AssistantModal;
