import { useState } from 'react';
import { updateMe } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { Key, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApiKeyDialog({ open, onClose }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  if (!open) return null;

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const updated = await updateMe({ anthropic_api_key: apiKey.trim() });
      setUser(updated);
      toast.success('API key saved');
      setApiKey('');
      onClose();
    } catch {
      toast.error('Failed to save API key');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Key size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Anthropic API Key</h2>
            <p className="text-sm text-gray-500">Required for AI chat</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Enter your Anthropic API key to use the AI assistant. Your key is stored securely
          and only used for your requests. Get one at{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 underline"
          >
            console.anthropic.com
          </a>
        </p>

        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-mono mb-4"
          autoFocus
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Check size={14} />
            {saving ? 'Saving...' : 'Save key'}
          </button>
        </div>
      </div>
    </div>
  );
}
