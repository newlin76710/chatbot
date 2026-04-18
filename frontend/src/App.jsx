import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useWorkspaceStore } from './store/workspaceStore';
import {
  LoginPage, RegisterPage, DashboardPage, FlowBuilderPage,
  BroadcastPage, SegmentsPage, ContactsPage, ChannelsPage,
  CampaignsPage, WorkspaceSettingsPage, JoinWorkspacePage,
} from './pages';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

function WorkspaceAdminGuard({ children }) {
  const myRole = useWorkspaceStore(s => s.myRole());
  return myRole === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const initAuth = useAuthStore(s => s.init);
  useEffect(() => { initAuth(); }, [initAuth]);
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/join-workspace" element={<ProtectedRoute><JoinWorkspacePage /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="flows" element={<FlowBuilderPage />} />
          <Route path="flows/:id" element={<FlowBuilderPage />} />
          <Route path="broadcasts" element={<BroadcastPage />} />
          <Route path="segments" element={<SegmentsPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="workspace-settings" element={
            <WorkspaceAdminGuard><WorkspaceSettingsPage /></WorkspaceAdminGuard>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
