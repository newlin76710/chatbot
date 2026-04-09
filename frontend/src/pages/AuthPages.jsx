// LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
};

export function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC' }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 16, padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 12 }}>B</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0F172A' }}>Welcome back</h1>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 14 }}>Sign in to BotFlow</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Email</label>
            <input type="email" style={inputStyle} value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" required />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Password</label>
            <input type="password" style={inputStyle} value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px', borderRadius: 8,
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff',
            border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748B' }}>
          Don't have an account? <Link to="/register" style={{ color: '#6366F1', fontWeight: 500 }}>Register</Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC' }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 16, padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 12 }}>B</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0F172A' }}>Create account</h1>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 14 }}>Start building chatbots for free</p>
        </div>
        <form onSubmit={handleSubmit}>
          {['name','email','password'].map(field => (
            <div key={field} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                style={inputStyle} value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={field === 'email' ? 'you@example.com' : field === 'password' ? '••••••••' : 'Your name'}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px', borderRadius: 8,
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff',
            border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8,
          }}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748B' }}>
          Already have an account? <Link to="/login" style={{ color: '#6366F1', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
