const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  // Default to localhost if not set (for development)
  return 'http://localhost:8000';
};

export const API_BASE_URL = `${getBaseUrl()}/api/v1`;

export const getWsUrl = (token: string) => {
  const baseUrl = getBaseUrl();
  const protocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  // Strip protocol from baseUrl
  const hostAndPath = baseUrl.replace(/^https?:\/\//, '');
  return `${protocol}://${hostAndPath}/api/v1/ws/drive?token=${token}`;
};
