import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, AlertCircle, RefreshCw, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MeetingCard from '../components/MeetingCard';
import MeetingCardSkeleton from '../components/MeetingCardSkeleton';

const Dashboard = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:8000/v1/meetings?page=${page}&limit=12`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch meetings');
      }
      
      const data = await response.json();
      setMeetings(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim();
    if (cleanTitle.length < 2 || cleanTitle.length > 255) {
      setCreateError('Meeting title must be between 2 and 255 characters.');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/v1/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: cleanTitle })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to create meeting');
      }

      const data = await response.json();
      setShowCreateModal(false);
      setNewTitle('');
      navigate(`/meetings/${data.id}`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#fff' }}>Dashboard</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>Overview of your recorded meetings and insights.</p>
        </div>

        <button
          onClick={() => { setShowCreateModal(true); setCreateError(null); }}
          style={{
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            border: 'none',
            borderRadius: '10px',
            padding: '0.75rem 1.25rem',
            color: '#fff',
            fontWeight: '600',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(168, 85, 247, 0.3)',
            transition: 'transform 0.2s, opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Plus size={18} /> Create New Meeting
        </button>
      </div>

      {/* Controls: Search and Filter (Dummy for MVP visual layout as requested) */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{
          flex: 1,
          maxWidth: '400px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem'
        }}>
          <Search size={18} color="rgba(255,255,255,0.5)" />
          <input 
            type="text" 
            placeholder="Search meetings by name..." 
            style={{ 
              background: 'transparent', border: 'none', color: '#fff', 
              width: '100%', outline: 'none', fontSize: '0.95rem' 
            }} 
          />
        </div>
        <button style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          cursor: 'pointer'
        }}>
          <Filter size={18} />
          Filters
        </button>
      </div>

      {/* Main Content Area */}
      {error ? (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '12px', padding: '2rem', textAlign: 'center', color: '#fff'
        }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h3>Unable to load meetings</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={fetchMeetings} style={{
            background: '#ef4444', border: 'none', borderRadius: '6px',
            padding: '0.5rem 1.5rem', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      ) : loading ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem'
        }}>
          {Array.from({ length: 6 }).map((_, i) => <MeetingCardSkeleton key={i} />)}
        </div>
      ) : meetings.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)',
          borderRadius: '12px', padding: '4rem 2rem', textAlign: 'center', color: '#fff'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto'
          }}>
            <Search size={32} color="rgba(255,255,255,0.5)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No meetings yet</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px', margin: '0 auto' }}>
            Start a meeting using the MeetInMin browser extension and your recorded meetings will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem'
          }}>
            {meetings.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
          
          {total > 12 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: '6px', background: 'rgba(255,255,255,0.1)',
                    border: 'none', color: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.5 : 1
                  }}
                >
                  Previous
                </button>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Page {page}</span>
                <button 
                  disabled={page * 12 >= total}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: '6px', background: 'rgba(255,255,255,0.1)',
                    border: 'none', color: '#fff', cursor: page * 12 >= total ? 'not-allowed' : 'pointer',
                    opacity: page * 12 >= total ? 0.5 : 1
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: '#12131e', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>Create New Meeting</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Meeting Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Marketing Strategy Sync"
                  value={newTitle}
                  minLength={2}
                  maxLength={255}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                  style={{
                    width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff',
                    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {createError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.7rem 1.25rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '0.7rem 1.5rem', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                    border: 'none', color: '#fff', fontWeight: '600', cursor: creating ? 'wait' : 'pointer',
                    opacity: creating ? 0.7 : 1
                  }}
                >
                  {creating ? 'Creating...' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
