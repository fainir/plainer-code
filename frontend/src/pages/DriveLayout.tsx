import { useQuery } from '@tanstack/react-query';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { getMyDrive } from '../api/drive';
import { useWebSocket } from '../hooks/useWebSocket';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import FolderExplorer from '../components/drive/FolderExplorer';
import ChatPanel from '../components/layout/ChatPanel';
import Drive from '../components/drive/Drive';

function ResizeHandle() {
  return (
    <Separator className="group w-1 relative flex items-center justify-center hover:bg-indigo-100 active:bg-indigo-200 transition-colors">
      <div className="w-px h-full bg-gray-200 group-hover:bg-indigo-400 group-active:bg-indigo-500 transition-colors" />
    </Separator>
  );
}

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-500">Failed to load your drive</p>
        </div>
      </div>
    );
  }

  if (isLoading || !drive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-gray-400">Loading your drive...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white">
      <Group orientation="horizontal">
        {/* Left: Folder Explorer */}
        <Panel defaultSize={15} minSize={10} maxSize={30}>
          <div className="h-full overflow-hidden">
            <FolderExplorer />
          </div>
        </Panel>

        <ResizeHandle />

        {/* Center: Drive */}
        <Panel minSize={30}>
          <div className="h-full overflow-hidden">
            <Drive />
          </div>
        </Panel>

        {/* Right: Chat Panel */}
        {chatPanelOpen && (
          <>
            <ResizeHandle />
            <Panel defaultSize={25} minSize={15} maxSize={45}>
              <div className="h-full overflow-hidden">
                <ChatPanel
                  send={send}
                  connected={connected}
                  userName={user?.display_name || 'You'}
                  userId={user?.id || ''}
                />
              </div>
            </Panel>
          </>
        )}
      </Group>
    </div>
  );
}
