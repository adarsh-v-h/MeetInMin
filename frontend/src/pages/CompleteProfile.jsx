import React, { useState } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';

const CompleteProfile = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If there's no token in the URL, someone probably navigated here by mistake.
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:8000/v1/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_token: token, username: username.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to complete profile');
      }

      // Profile completed! Save the real JWT and go to dashboard
      localStorage.setItem('token', data.access_token);
      navigate('/dashboard');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '3rem',
        width: '100%',
        maxWidth: '400px',
        backdropFilter: 'blur(10px)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
          Almost there!
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem' }}>
          Please pick a unique username to finish setting up your account.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jdoe2026"
              required
              style={{
                width: '100%', padding: '0.75rem 1rem',
                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.875rem',
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              border: 'none', borderRadius: '8px', color: '#000',
              fontSize: '1rem', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
