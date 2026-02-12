import { useQuery } from '@tanstack/react-query';
import { getMyDrive } from '../api/drive';
import { useWebSocket } from '../hooks/useWebSocket';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import FolderExplorer from '../components/drive/FolderExplorer';
import ChatPanel from '../components/layout/ChatPanel';
import Drive from '../components/drive/Drive';

export default function DriveLayout() {
  const { chatPanelOpen } = useUIStore();
  const user = useAuthStore((s) => s.user);

  const { data: drive, isLoading, error } = useQuery({
    queryKey: ['drive'],
    queryFn: getMyDrive,
  });

  const { send, connected } = useWebSocket();

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Failed to load your drive</p>
        </div>
      </div>
    );
  }

  if (isLoading || !drive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading your drive...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Left: Folder Explorer — fixed width */}
      <div className="w-56 shrink-0 h-full">
        <FolderExplorer />
      </div>

      {/* Center: File Viewer — flexible */}
      <div className="flex-1 min-w-0 h-full overflow-hidden border-l border-gray-200">
        <Drive />
      </div>

      {/* Right: Chat Panel — fixed width */}
      {chatPanelOpen && (
        <div className="w-[400px] shrink-0 h-full border-l border-gray-200">
          <ChatPanel
            send={send}
            connected={connected}
            userName={user?.display_name || 'You'}
            userId={user?.id || ''}
          />
        </div>
      )}
    </div>
  );
}
