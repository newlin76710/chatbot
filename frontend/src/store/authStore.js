import { create } from 'zustand';
import api from '../utils/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, token });
      const { useWorkspaceStore } = await import('./workspaceStore');
      useWorkspaceStore.getState().setWorkspaces(data.workspaces || []);
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token, loading: false });
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.getState().setWorkspaces(data.workspaces || []);
    return data;
  },

  register: async (name, email, password) => {
    set({ loading: true });
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token, loading: false });
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.getState().setWorkspaces(data.workspaces || []);
    return data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeWorkspaceId');
    localStorage.removeItem('activeChannelId');
    set({ user: null, token: null });
    import('./workspaceStore').then(({ useWorkspaceStore }) => {
      useWorkspaceStore.getState().clearWorkspaces();
    });
  },
}));
