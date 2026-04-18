import { create } from 'zustand';
import api from '../utils/api';

export const useWorkspaceStore = create((set, get) => ({
  workspaces: [],
  activeWorkspaceId: localStorage.getItem('activeWorkspaceId'),
  activeWorkspace: null,

  setWorkspaces: (workspaces) => {
    if (!workspaces?.length) { set({ workspaces: [] }); return; }
    const current = get().activeWorkspaceId;
    const stillValid = workspaces.some(w => w.id === current);
    const activeWorkspaceId = stillValid ? current : workspaces[0].id;
    if (activeWorkspaceId !== current) {
      localStorage.setItem('activeWorkspaceId', activeWorkspaceId);
    }
    set({ workspaces, activeWorkspaceId });
  },

  fetchWorkspaces: async () => {
    const { data } = await api.get('/workspaces');
    get().setWorkspaces(data.workspaces);
    return data.workspaces;
  },

  setActiveWorkspace: (id) => {
    localStorage.setItem('activeWorkspaceId', id);
    localStorage.removeItem('activeChannelId');
    set({ activeWorkspaceId: id, activeWorkspace: null });
  },

  fetchActiveWorkspace: async () => {
    const id = get().activeWorkspaceId;
    if (!id) return;
    const { data } = await api.get(`/workspaces/${id}`);
    set({ activeWorkspace: data.workspace });
    return data.workspace;
  },

  createWorkspace: async (name) => {
    const { data } = await api.post('/workspaces', { name });
    const newWs = { id: data.workspace.id, name: data.workspace.name, role: 'admin' };
    set(s => ({ workspaces: [...s.workspaces, newWs] }));
    return data.workspace;
  },

  inviteMember: async (email, role) => {
    const id = get().activeWorkspaceId;
    const { data } = await api.post(`/workspaces/${id}/invites`, { email, role });
    return data;
  },

  updateMemberRole: async (userId, role) => {
    const id = get().activeWorkspaceId;
    await api.put(`/workspaces/${id}/members/${userId}`, { role });
    await get().fetchActiveWorkspace();
  },

  removeMember: async (userId) => {
    const id = get().activeWorkspaceId;
    await api.delete(`/workspaces/${id}/members/${userId}`);
    await get().fetchActiveWorkspace();
  },

  renameWorkspace: async (name) => {
    const id = get().activeWorkspaceId;
    await api.put(`/workspaces/${id}`, { name });
    set(s => ({
      workspaces: s.workspaces.map(w => w.id === id ? { ...w, name } : w),
      activeWorkspace: s.activeWorkspace ? { ...s.activeWorkspace, name } : null,
    }));
  },

  deleteWorkspace: async () => {
    const id = get().activeWorkspaceId;
    await api.delete(`/workspaces/${id}`);
    const remaining = get().workspaces.filter(w => w.id !== id);
    const nextId = remaining[0]?.id || null;
    if (nextId) localStorage.setItem('activeWorkspaceId', nextId);
    else localStorage.removeItem('activeWorkspaceId');
    set({ workspaces: remaining, activeWorkspaceId: nextId, activeWorkspace: null });
  },

  myRole: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find(w => w.id === activeWorkspaceId)?.role ?? 'viewer';
  },

  clearWorkspaces: () => {
    localStorage.removeItem('activeWorkspaceId');
    set({ workspaces: [], activeWorkspaceId: null, activeWorkspace: null });
  },
}));
