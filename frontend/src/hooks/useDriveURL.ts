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

    if (path.startsWith('/file/') && params.fileId) {
      const fId = params.fileId;
      const state = useDriveStore.getState();
      if (state.selectedFileId === fId) return;

      getFileContent(fId)
        .then((file) => {
          const fileType = file.is_instance ? 'instance' : undefined;
          setFromURL(null, fId, file.name, fileType || null, 'private');
        })
        .catch(() => {
          navigate('/private', { replace: true });
        });
    } else if (path.startsWith('/folder/') && params.folderId) {
      const fId = params.folderId;
      const state = useDriveStore.getState();
      if (state.currentFolderId === fId && !state.selectedFileId) return;

      setFromURL(fId, null, null, null, 'private');
    } else if (path === '/shared') {
      const state = useDriveStore.getState();
      if (state.view === 'shared' && !state.selectedFileId) return;

      setView('shared');
    } else if (path === '/private') {
      const state = useDriveStore.getState();
      if (state.view === 'private' && !state.selectedFileId && !state.currentFolderId) return;
      if (!initialised.current) {
        // First load on /private — let the existing init logic handle it
        initialised.current = true;
        return;
      }
      setFromURL(null, null, null, null, 'private');
    }

    initialised.current = true;
  }, [location.pathname, params.fileId, params.folderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Store → URL (when state changes from UI) ─────────
  useEffect(() => {
    const state = useDriveStore.getState();

    // Skip if this state change came from URL parsing
    if (state._fromURL) return;

    let targetPath = '/private';

    if (selectedFileId) {
      targetPath = `/file/${selectedFileId}`;
    } else if (view === 'shared') {
      targetPath = '/shared';
    } else if (currentFolderId) {
      targetPath = `/folder/${currentFolderId}`;
    }

    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [selectedFileId, currentFolderId, view]); // eslint-disable-line react-hooks/exhaustive-deps
}
