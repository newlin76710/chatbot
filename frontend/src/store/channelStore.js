import { create } from 'zustand';
import api from '../utils/api';

export const useChannelStore = create((set, get) => ({
  channels: [],
  activeChannelId: localStorage.getItem('activeChannelId'),
  channelsReady: false,

  fetchChannels: async () => {
    if (!localStorage.getItem('activeWorkspaceId')) {
      set({ channels: [], channelsReady: true });
      return;
    }
    const { data } = await api.get('/channels');
    const current = get().activeChannelId;
    const stillValid = data.channels.some(c => c._id === current);
    let activeChannelId = current;
    if (!stillValid) {
      if (data.channels.length > 0) {
        activeChannelId = data.channels[0]._id;
        localStorage.setItem('activeChannelId', activeChannelId);
      } else {
        activeChannelId = null;
        localStorage.removeItem('activeChannelId');
      }
    }
    set({ channels: data.channels, activeChannelId, channelsReady: true });
  },

  setActiveChannel: (id) => {
    localStorage.setItem('activeChannelId', id);
    set({ activeChannelId: id });
  },

  createChannel: async (payload) => {
    const { data } = await api.post('/channels', payload);
    set(s => ({ channels: [data.channel, ...s.channels] }));
    return data.channel;
  },

  deleteChannel: async (id) => {
    await api.delete(`/channels/${id}`);
    set(s => ({ channels: s.channels.filter(c => c._id !== id) }));
  },
}));
