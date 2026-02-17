import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { HardDrive, Users, Clock, MessageSquare, LogOut, Key } from 'lucide-react';
import ApiKeyDialog from '../ApiKeyDialog';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleChatPanel, chatPanelOpen } = useUIStore();
  const { user, logout } = useAuthStore();
  const [showApiKey, setShowApiKey] = useState(false);

  const navItems = [
    { label: 'My Drive', icon: HardDrive, path: '/private' },
    { label: 'Shared with me', icon: Users, path: '/shared' },
    { label: 'Recent', icon: Clock, path: '/private' },
  ];

  return (
    <>
      <div className="w-60 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
        {/* App header */}
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Plainer</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your AI-powered drive</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
                  isActive
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            );
          })}

          <div className="h-px bg-gray-100 my-2" />

          <button
            onClick={toggleChatPanel}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
              chatPanelOpen
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageSquare size={16} />
            AI Chat
          </button>
        </nav>

        {/* API Key */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowApiKey(true)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
              user?.has_api_key
                ? 'text-gray-600 hover:bg-gray-50'
                : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <Key size={16} />
            {user?.has_api_key ? 'API Key' : 'Add API Key'}
            {user?.has_api_key && (
              <span className="ml-auto w-2 h-2 bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        {/* User */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-medium text-indigo-600 shrink-0">
                {user?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-sm text-gray-700 truncate">{user?.display_name}</span>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      <ApiKeyDialog open={showApiKey} onClose={() => setShowApiKey(false)} />
    </>
  );
}
