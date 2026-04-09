import { create } from 'zustand';
import api from '../utils/api';

export const useChannelStore = create((set, get) => ({
  channels: [],
  activeChannelId: localStorage.getItem('activeChannelId'),

  fetchChannels: async () => {
    const { data } = await api.get('/channels');
    set({ channels: data.channels });
    // Auto-select first if none selected
    if (!get().activeChannelId && data.channels.length > 0) {
      const id = data.channels[0]._id;
      localStorage.setItem('activeChannelId', id);
      set({ activeChannelId: id });
    }
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
