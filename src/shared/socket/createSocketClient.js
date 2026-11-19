import { io } from 'socket.io-client';
import { getBackendUrl } from '../api/backendUrl.js';

// Factory instead of a module-level singleton — see createApiClient.js for why:
// agent and admin each need their own isolated socket connection.
export function createSocketClient() {
  let socket = null;

  // Sprint 1 scope: connect + room join only (see backend src/sockets/index.js).
  // No business notification events are emitted by the server yet.
  function connectSocket(accessToken) {
    disconnectSocket();

    socket = io(getBackendUrl(), {
      path: '/socket.io',
      auth: { token: accessToken },
      autoConnect: true,
      withCredentials: true,
    });

    return socket;
  }

  function disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function getSocket() {
    return socket;
  }

  return { connectSocket, disconnectSocket, getSocket };
}
