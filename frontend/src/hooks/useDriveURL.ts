import { useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import { useDriveStore } from '../stores/driveStore';
import { getFileContent } from '../api/drive';

/**
 * Bidirectional sync between drive store state and URL.
 *
 * URL → Store: on mount / direct navigation, parse URL and set store state.
 * Store → URL: when user navigates via UI, update the URL to match.
 */
export function useDriveURL() {
  const params = useParams<{ folderId?: string; fileId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const initialised = useRef(false);

  const {
    view, currentFolderId, selectedFileId,
    setView, setFromURL,
  } = useDriveStore();

  // ── URL → Store (on mount or URL change) ──────────────
  useEffect(() => {
    const path = location.pathname;

    if (path.startsWith('/drive/file/') && params.fileId) {
      // File URL — fetch file info and select it
      const fId = params.fileId;
      const state = useDriveStore.getState();
      if (state.selectedFileId === fId) return; // already there

      getFileContent(fId)
        .then((file) => {
          const fileType = file.is_instance ? 'instance' : undefined;
          setFromURL(null, fId, file.name, fileType || null, 'private');
        })
        .catch(() => {
          // File not found — go to drive root
          navigate('/drive', { replace: true });
        });
    } else if (path.startsWith('/drive/folder/') && params.folderId) {
      // Folder URL — set folder ID
      const fId = params.folderId;
      const state = useDriveStore.getState();
      if (state.currentFolderId === fId && !state.selectedFileId) return;

      setFromURL(fId, null, null, null, 'private');
    } else if (path === '/drive/shared') {
      const state = useDriveStore.getState();
      if (state.view === 'shared' && !state.selectedFileId) return;

      setView('shared');
    } else if (path === '/drive') {
      // Root — only reset if we haven't initialised yet
      if (!initialised.current) {
        initialised.current = true;
      }
    }

    initialised.current = true;
  }, [location.pathname, params.fileId, params.folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Store → URL (when state changes from UI) ─────────
  useEffect(() => {
    const state = useDriveStore.getState();

    // Skip if this state change came from URL parsing
    if (state._fromURL) return;

    let targetPath = '/drive';

    if (selectedFileId) {
      targetPath = `/drive/file/${selectedFileId}`;
    } else if (view === 'shared') {
      targetPath = '/drive/shared';
    } else if (currentFolderId) {
      targetPath = `/drive/folder/${currentFolderId}`;
    }

    // Only update if different from current
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [selectedFileId, currentFolderId, view]); // eslint-disable-line react-hooks/exhaustive-deps
}
