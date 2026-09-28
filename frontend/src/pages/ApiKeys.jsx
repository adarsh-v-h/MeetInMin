import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, MoreVertical, Copy, Check, AlertTriangle, ShieldOff, Activity } from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ApiKeys = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Newly Created Secret State
  const [newSecret, setNewSecret] = useState(null);
  const [copied, setCopied] = useState(false);

  // Revoke Modal State
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  // Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/v1/api-keys', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const data = await res.json();
      setKeys(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    try {
      setCreating(true);
      const res = await fetch('http://localhost:8000/v1/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newName.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create key');
      
      // The backend returns the full created object, including secret_key
      setNewSecret(data.secret_key);
      setNewName('');
      
      // Update list silently
      setKeys(prev => [data, ...prev]);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      const res = await fetch(`http://localhost:8000/v1/api-keys/${revokeTarget.id}/revoke`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!res.ok) throw new Error('Failed to revoke key');
      
      // Update local state to show revoked
      setKeys(prev => prev.map(k => k.id === revokeTarget.id ? { ...k, status: 'REVOKED' } : k));
      setRevokeTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setNewSecret(null);
    setNewName('');
    setCopied(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#fff' }}>API Keys</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>Manage credentials used by the MeetInMin browser extension.</p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          style={{
            background: '#3b82f6', border: 'none', borderRadius: '8px',
            padding: '0.75rem 1.25rem', color: '#fff', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
          onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
        >
          <Plus size={18} /> Create New Key
        </button>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>Name</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>Created</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>Last Used</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: '500', color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Loading API keys...</td></tr>
            ) : error ? (
              <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>{error}</td></tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                    <Key size={24} color="rgba(255,255,255,0.5)" />
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>No API keys created yet.</p>
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: '500' }}>{key.name}</td>
                  <td style={{ padding: '1rem 1.5rem', color: 'rgba(255,255,255,0.7)' }}>{formatDate(key.created_at)}</td>
                  <td style={{ padding: '1rem 1.5rem', color: 'rgba(255,255,255,0.7)' }}>{formatDate(key.last_used_at)}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    {key.status === 'ACTIVE' ? (
                      <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Activity size={12} /> Active
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldOff size={12} /> Revoked
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right', position: 'relative' }}>
                    <button 
                      onClick={() => setOpenDropdownId(openDropdownId === key.id ? null : key.id)}
                      style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px' }}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {openDropdownId === key.id && (
                      <div style={{
                        position: 'absolute', right: '2.5rem', top: '1.5rem', zIndex: 10,
                        background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', overflow: 'hidden', backdropFilter: 'blur(10px)',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
                      }}>
                        <button 
                          disabled={key.status === 'REVOKED'}
                          onClick={() => { setRevokeTarget(key); setOpenDropdownId(null); }}
                          style={{
                            display: 'block', width: '100%', padding: '0.75rem 1rem', background: 'transparent', 
                            border: 'none', color: key.status === 'REVOKED' ? 'rgba(255,255,255,0.3)' : '#ef4444', 
                            cursor: key.status === 'REVOKED' ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: '0.9rem',
                            minWidth: '120px'
                          }}
                        >
                          Revoke Key
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '500px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {!newSecret ? (
              <form onSubmit={handleCreate}>
                <h2 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.5rem' }}>Create API Key</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  Give your new key a recognizable name (e.g. "Work Laptop").
                </p>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Key Name"
                  required
                  maxLength={50}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', marginBottom: '1.5rem', boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" onClick={closeCreateModal} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={creating} style={{ background: '#3b82f6', border: 'none', borderRadius: '8px', padding: '0.5rem 1.5rem', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                    {creating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '1rem' }}>
                  <Check size={24} />
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Key Generated</h2>
                </div>
                
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                  <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Please copy this API key now. For security reasons, <strong>you will not be able to view it again</strong> once you close this window.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={newSecret}
                    style={{
                      flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(0,0,0,0.5)', color: '#3b82f6', fontSize: '1rem', fontFamily: 'monospace'
                    }}
                  />
                  <button onClick={copyToClipboard} style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px', padding: '0 1rem', color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    {copied ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={closeCreateModal} style={{ background: '#3b82f6', border: 'none', borderRadius: '8px', padding: '0.75rem 2rem', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REVOKE CONFIRMATION MODAL */}
      {revokeTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px'
          }}>
            <h2 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.25rem' }}>Revoke API Key?</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Are you sure you want to revoke <strong>"{revokeTarget.name}"</strong>?<br/><br/>
              This key will immediately stop working. Existing meetings created with this key will remain available.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setRevokeTarget(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRevoke} disabled={revoking} style={{ background: '#ef4444', border: 'none', borderRadius: '8px', padding: '0.5rem 1.5rem', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                {revoking ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ApiKeys;
