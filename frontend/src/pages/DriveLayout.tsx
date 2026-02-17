import { useQuery } from '@tanstack/react-query';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { getMyDrive } from '../api/drive';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDriveURL } from '../hooks/useDriveURL';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import FolderExplorer from '../components/drive/FolderExplorer';
import ChatPanel from '../components/layout/ChatPanel';
import Drive from '../components/drive/Drive';

function ResizeHandle() {
  return (
    <Separator
      style={{ width: 5, cursor: 'col-resize' }}
      className="relative flex items-center justify-center bg-transparent hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
    >
      <div className="w-px h-full bg-gray-200" />
    </Separator>
  );
}

export default function DriveLayout() {
  useDriveURL();
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
    <div className="h-screen w-screen overflow-hidden bg-white">
      <Group orientation="horizontal" style={{ height: '100%', width: '100%' }}>
        {/* Left: Folder Explorer */}
        <Panel defaultSize="220px" minSize="160px" maxSize="400px">
          <div className="h-full overflow-hidden">
            <FolderExplorer />
          </div>
        </Panel>

        <ResizeHandle />

        {/* Center: Drive */}
        <Panel minSize="300px">
          <div className="h-full overflow-hidden">
            <Drive />
          </div>
        </Panel>

        {/* Right: Chat Panel */}
        {chatPanelOpen && (
          <>
            <ResizeHandle />
            <Panel defaultSize="360px" minSize="280px" maxSize="600px">
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
