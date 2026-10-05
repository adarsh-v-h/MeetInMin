import React, { useState, useEffect, useCallback } from 'react';
import { User, Mail, Link as LinkIcon, Unlink, AlertTriangle, CheckCircle2, Download, Puzzle } from 'lucide-react';

const Settings = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/v1/users/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleConnectGoogle = () => {
    // Redirects directly to the backend OAuth initialization endpoint
    window.location.href = 'http://localhost:8000/v1/auth/login/google';
  };

  const handleDisconnectGoogle = async () => {
    try {
      setDisconnecting(true);
      const res = await fetch('http://localhost:8000/v1/users/me/disconnect-google', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!res.ok) throw new Error('Failed to disconnect Google account');
      
      // Update local state to reflect disconnection
      setProfile(prev => ({ ...prev, is_google_connected: false }));
      setIsDisconnectModalOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#fff', padding: '2rem' }}>Loading settings...</div>;
  }

  if (error) {
    return <div style={{ color: '#ef4444', padding: '2rem' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', maxWidth: '800px' }}>
      
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#fff' }}>Settings</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>Manage your account and third-party integrations.</p>
      </div>

      {/* Account Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2rem',
        backdropFilter: 'blur(10px)'
      }}>
        <h2 style={{ fontSize: '1.25rem', color: '#fff', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={20} color="#3b82f6" /> Account Information
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Username</label>
            <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '500' }}>@{profile?.username}</div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Email Address</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '1.1rem' }}>
              <Mail size={16} color="rgba(255,255,255,0.5)" /> {profile?.email}
            </div>
          </div>
        </div>
      </div>

      {/* Google Integration Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2rem',
        backdropFilter: 'blur(10px)'
      }}>
        <h2 style={{ fontSize: '1.25rem', color: '#fff', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LinkIcon size={20} color="#f59e0b" /> Google Integration
        </h2>
        
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>
          Connecting your Google account allows MeetInMin to analyze your Gmail inbox. We use this context to intelligently correlate meeting decisions with ongoing email threads and suggest actionable follow-ups.
        </p>

        {profile?.is_google_connected ? (
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '1.5rem', borderRadius: '12px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <CheckCircle2 size={24} color="#10b981" />
              <div>
                <div style={{ color: '#fff', fontWeight: '600', marginBottom: '4px' }}>Google Account Connected</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Mailbox intelligence is active.</div>
              </div>
            </div>
            <button 
              onClick={() => setIsDisconnectModalOpen(true)}
              style={{
                background: 'transparent', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '8px',
                padding: '0.5rem 1rem', color: '#ef4444', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Unlink size={16} /> Disconnect
            </button>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(255, 255, 255, 0.2)',
            padding: '1.5rem', borderRadius: '12px' 
          }}>
            <div>
              <div style={{ color: '#fff', fontWeight: '600', marginBottom: '4px' }}>Google Account Not Connected</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Connect Gmail to enable follow-up suggestions.</div>
            </div>
            <button 
              onClick={handleConnectGoogle}
              style={{
                background: '#fff', border: 'none', borderRadius: '8px',
                padding: '0.75rem 1.5rem', color: '#000', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              <LinkIcon size={16} /> Connect Google
            </button>
          </div>
        )}
      </div>

      {/* Chrome Extension Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2rem',
        backdropFilter: 'blur(10px)'
      }}>
        <h2 style={{ fontSize: '1.25rem', color: '#fff', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Puzzle size={20} color="#6366f1" /> Chrome Extension
        </h2>
        
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          The MeetInMin Chrome extension silently records meeting audio from your browser tab without any bots. Download the extension ZIP and install it in Chrome via Developer Mode (<code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#a5b4fc' }}>chrome://extensions</code>).
        </p>

        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
          background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)',
          padding: '1.5rem', borderRadius: '12px' 
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: '600', marginBottom: '4px' }}>MeetInMin Chrome Extension (v0.1.0)</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>ZIP package ready for developer mode installation.</div>
          </div>
          <a 
            href="/MeetInMin-Extension.zip" 
            download="MeetInMin-Extension.zip"
            style={{
              background: '#6366f1', border: 'none', borderRadius: '8px',
              padding: '0.75rem 1.5rem', color: '#fff', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', transition: 'opacity 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <Download size={16} /> Download Extension
          </a>
        </div>
      </div>

      {/* DISCONNECT CONFIRMATION MODAL */}
      {isDisconnectModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '450px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <AlertTriangle size={28} color="#ef4444" />
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>Disconnect Google?</h2>
            </div>
            
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              <p style={{ margin: '0 0 1rem 0' }}>MeetInMin will no longer be able to access your Gmail mailbox.</p>
              <p style={{ margin: '0 0 1rem 0' }}>This may reduce the accuracy and usefulness of meeting-to-email suggestions.</p>
              <p style={{ margin: 0 }}>Your existing meeting data and previously processed information will remain available.</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setIsDisconnectModalOpen(false)} 
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '0.75rem 1.5rem', color: '#fff', cursor: 'pointer', fontWeight: '500' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDisconnectGoogle} 
                disabled={disconnecting} 
                style={{ background: '#ef4444', border: 'none', borderRadius: '8px', padding: '0.75rem 1.5rem', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Unlink size={16} /> {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
