import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BookOpen,
  Target,
  FileText,
  BarChart3,
  Rocket,
  Send,
  Zap,
  LineChart,
  MessageCircle,
  Settings,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { getCurrentUser } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import UserMenu from '../components/auth/UserMenu';

const MODULES = [
  {
    id: 'account-management',
    name: 'Account Management',
    description: 'Track deals, analyze calls, and manage your sales pipeline with AI-powered insights',
    icon: LayoutDashboard,
    href: '/modules/account-pipeline',
    color: 'from-blue-500 to-blue-600',
    available: true,
    status: 'live' // live, in-progress, coming-soon
  },
  {
    id: 'outbound-engine',
    name: 'Outbound Engine',
    description: 'Prospect tracking, contact management, and AI-powered outreach intelligence',
    icon: Send,
    href: '/modules/outbound-engine',
    color: 'from-purple-500 to-purple-600',
    available: true,
    status: 'in-progress'
  },
  {
    id: 'content',
    name: 'Content',
    description: 'Sales collateral, 1-pagers, decks, and client-ready materials with Google Drive integration',
    icon: BookOpen,
    href: '/modules/content',
    color: 'from-indigo-500 to-indigo-600',
    available: true,
    status: 'in-progress'
  },
  {
    id: 'sales-reports',
    name: 'Sales Reports',
    description: 'Performance metrics, forecasting, and pipeline health dashboards',
    icon: BarChart3,
    href: '#',
    color: 'from-green-500 to-green-600',
    available: false,
    status: 'coming-soon'
  },
  {
    id: 'pipeline-review',
    name: 'Pipeline Review',
    description: 'Weekly pipeline inspection, deal health scoring, and forecast accuracy',
    icon: LineChart,
    href: '#',
    color: 'from-amber-500 to-amber-600',
    available: false,
    status: 'coming-soon'
  },
  {
    id: 'rep-coaching',
    name: 'Rep Coaching',
    description: 'Call reviews, skill development, and performance improvement plans',
    icon: MessageCircle,
    href: '#',
    color: 'from-pink-500 to-pink-600',
    available: false,
    status: 'coming-soon'
  },
  {
    id: 'sales-processes',
    name: 'Sales Processes',
    description: 'Playbooks, methodologies, deal stages, and workflow automation',
    icon: Zap,
    href: '#',
    color: 'from-cyan-500 to-cyan-600',
    available: false,
    status: 'coming-soon'
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Team configuration, integrations, user permissions, and preferences',
    icon: Settings,
    href: '#',
    color: 'from-gray-500 to-gray-600',
    available: false,
    status: 'coming-soon'
  },
];

const ModuleCard = ({ module }) => {
  const router = useRouter();
  const Icon = module.icon;

  const handleClick = () => {
    if (module.available) {
      router.push(module.href);
    }
  };

  // Status badge configuration
  const getStatusBadge = () => {
    switch (module.status) {
      case 'live':
        return {
          text: 'Live',
          className: 'bg-red-500 text-white',
          icon: '●'
        };
      case 'in-progress':
        return {
          text: 'In Progress',
          className: 'bg-amber-500 text-white',
          icon: '◐'
        };
      case 'coming-soon':
      default:
        return {
          text: 'Coming Soon',
          className: 'bg-gray-200 text-gray-600',
          icon: '○'
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <button
      onClick={handleClick}
      disabled={!module.available}
      className={`relative group overflow-hidden rounded-2xl p-8 text-left transition-all duration-300 ${
        module.available
          ? 'bg-white hover:shadow-2xl hover:-translate-y-1 cursor-pointer border-2 border-gray-100 hover:border-blue-200'
          : 'bg-gray-50 border-2 border-gray-200 cursor-not-allowed opacity-60'
      }`}
    >
      {/* Gradient background on hover */}
      {module.available && (
        <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      )}

      {/* Status Badge */}
      <div className="absolute top-4 right-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${statusBadge.className}`}>
          <span className="text-[10px]">{statusBadge.icon}</span>
          {statusBadge.text}
        </span>
      </div>

      {/* Icon */}
      <div className={`relative inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${module.color} mb-6 ${
        module.available ? 'group-hover:scale-110' : ''
      } transition-transform duration-300`}>
        <Icon className="w-8 h-8 text-white" />
      </div>

      {/* Content */}
      <div className="relative">
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {module.name}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed">
          {module.description}
        </p>
      </div>

      {/* Arrow indicator */}
      {module.available && (
        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Rocket className="w-5 h-5 text-blue-500" />
        </div>
      )}
    </button>
  );
};

export default function ModulesPage() {
  const router = useRouter();
  const { user, setUser, setIsLoading, getUserName } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const useAuth = isSupabaseConfigured() && process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false';

      if (useAuth) {
        setIsLoading(true);
        const { user } = await getCurrentUser();

        if (!user) {
          router.push('/login');
        } else {
          setUser(user);
          setIsReady(true);
        }
        setIsLoading(false);
      } else {
        // Auth disabled - allow access
        setIsReady(true);
      }
    };

    checkAuth();
  }, []);

  const handleAiSend = async () => {
    if (!aiInput.trim() || isAiLoading) return;

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAiLoading(true);

    try {
      const response = await fetch('/api/platform-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, modules: MODULES })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      setAiMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        suggestedModule: data.suggestedModule
      }]);
    } catch (error) {
      setAiMessages(prev => [...prev, {
        role: 'error',
        content: error.message
      }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Banner Sales Platform</h1>
              {user && <p className="text-sm text-gray-600 mt-1">Welcome back, {getUserName()}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAIAssistant(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                AI Assistant
              </button>
              {user && <UserMenu />}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Sales Modules</h2>
          <p className="text-gray-600">Select a module to get started</p>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES.map(module => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </div>

      {/* AI Assistant Sidebar */}
      {showAIAssistant && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col border-l">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <div>
                <h2 className="font-semibold">AI Assistant</h2>
                <p className="text-xs text-blue-100">Ask me anything</p>
              </div>
            </div>
            <button
              onClick={() => setShowAIAssistant(false)}
              className="p-1 hover:bg-blue-500 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.length === 0 && (
              <div className="text-center py-4">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-blue-200" />
                <p className="text-gray-600 mb-4">
                  Ask me for help navigating the platform
                </p>
                <div className="space-y-2 text-left">
                  <p className="text-xs text-gray-500 mb-2">Try asking:</p>
                  {[
                    "What am I doing wrong?",
                    "I need a call script for a discovery call",
                    "I need a battle card for competing with Yardi",
                    "Where do I find my pipeline metrics?"
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setAiInput(prompt)}
                      className="block w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiMessages.map((msg, i) => (
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
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.suggestedModule && (
                    <button
                      onClick={() => router.push(MODULES.find(m => m.id === msg.suggestedModule)?.href || '#')}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Go to {MODULES.find(m => m.id === msg.suggestedModule)?.name} →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isAiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
                placeholder="Ask or search..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAiLoading}
              />
              <button
                onClick={handleAiSend}
                disabled={isAiLoading || !aiInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
