import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Calendar, Clock, Key, Download, 
  CheckSquare, FileText, Lightbulb, AlertCircle, RefreshCw
} from 'lucide-react';

const getStatusConfig = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'completed') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', text: 'Completed', isProcessing: false };
  if (normalized === 'failed') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'Failed', isProcessing: false };
  return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', text: status.charAt(0).toUpperCase() + status.slice(1), isProcessing: true };
};

const formatDuration = (seconds) => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown Date';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

const Section = ({ title, icon, children, className = '' }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '1.5rem',
    backdropFilter: 'blur(10px)',
    display: 'flex', flexDirection: 'column'
  }} className={className}>
    <h3 style={{ 
      fontSize: '1.1rem', fontWeight: '600', color: '#fff', 
      marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
      borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem'
    }}>
      {icon} {title}
    </h3>
    <div style={{ flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem', lineHeight: '1.6' }}>
      {children}
    </div>
  </div>
);

const ProcessingPlaceholder = ({ text }) => (
  <div style={{ 
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
    height: '150px', color: 'rgba(255,255,255,0.5)', gap: '1rem' 
  }}>
    <div style={{
      width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6',
      animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
    }} />
    <span>{text}</span>
  </div>
);

const MeetingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const fetchMeeting = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:8000/v1/meetings/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch meeting details');
      const data = await response.json();
      setMeeting(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await fetch(`http://localhost:8000/v1/meetings/${id}/audio`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Audio download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting_${id}_audio.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch(err) {
      alert("Could not download audio. The file might be processing or deleted.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: '4rem' }}>Loading meeting details...</div>;
  }

  if (error) {
    return (
      <div style={{ color: '#fff', textAlign: 'center', marginTop: '4rem' }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h3>Error loading meeting</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Go Back</button>
      </div>
    );
  }

  if (!meeting) return null;

  const statusConfig = getStatusConfig(meeting.status);
  const isProcessing = statusConfig.isProcessing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', paddingBottom: '4rem' }}>
      
      {/* Back Button */}
      <button 
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer', padding: 0, fontSize: '0.9rem', width: 'fit-content'
        }}
      >
        <ChevronLeft size={16} /> Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '2rem', backdropFilter: 'blur(10px)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>
              {meeting.title}
            </h1>
            <div style={{
              padding: '4px 12px', borderRadius: '20px', background: statusConfig.bg, color: statusConfig.color,
              fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              {isProcessing && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusConfig.color, animation: 'pulse 1.5s infinite' }} />}
              {statusConfig.text}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={16} /> {formatDate(meeting.created_at)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={16} /> {formatDuration(meeting.duration)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Key size={16} /> {meeting.api_key_name || 'Unknown Key'}</div>
          </div>
        </div>

        <button 
          onClick={handleDownload}
          disabled={downloading}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px', padding: '0.75rem 1.25rem', color: '#fff', fontWeight: '500',
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: downloading ? 'wait' : 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          <Download size={18} />
          {downloading ? 'Downloading...' : 'Download Audio'}
        </button>
      </div>

      {/* Grid Layout for Insights & Transcript */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: AI Intelligence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <Section title="Executive Summary" icon={<FileText size={18} color="#a855f7" />}>
            {isProcessing ? <ProcessingPlaceholder text="Generating summary..." /> : 
             !meeting.insight ? <span style={{color: 'rgba(255,255,255,0.4)'}}>No summary available.</span> :
             <p>{meeting.insight.summary}</p>
            }
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <Section title="Action Items" icon={<CheckSquare size={18} color="#10b981" />}>
              {isProcessing ? <ProcessingPlaceholder text="Extracting action items..." /> : 
               !meeting.insight?.action_items?.length ? <span style={{color: 'rgba(255,255,255,0.4)'}}>No action items found.</span> :
               <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {meeting.insight.action_items.map((item, i) => (
                   <li key={i} style={{ 
                     display: 'flex', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', 
                     padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'
                   }}>
                     <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0, marginTop: '2px' }} />
                     <div>
                       <div style={{ marginBottom: '4px', color: '#fff' }}>{item.task}</div>
                       <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'inline-block', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                         Owner: {item.assignee || 'Unassigned'}
                       </div>
                     </div>
                   </li>
                 ))}
               </ul>
              }
            </Section>

            <Section title="Key Decisions" icon={<Lightbulb size={18} color="#f59e0b" />}>
              {isProcessing ? <ProcessingPlaceholder text="Extracting decisions..." /> : 
               !meeting.insight?.key_decisions?.length ? <span style={{color: 'rgba(255,255,255,0.4)'}}>No decisions found.</span> :
               <ul style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 {meeting.insight.key_decisions.map((dec, i) => (
                   <li key={i}>{dec.decision_text}</li>
                 ))}
               </ul>
              }
            </Section>
          </div>

          <Section title="Suggested Actions (Gmail)" icon={<RefreshCw size={18} color="#3b82f6" />}>
            <div style={{ 
              background: 'rgba(59, 130, 246, 0.05)', border: '1px dashed rgba(59, 130, 246, 0.3)',
              padding: '1.5rem', borderRadius: '8px', textAlign: 'center'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Suggestions will appear when MeetInMin finds useful connections between your meetings and mailbox.</span>
            </div>
          </Section>

        </div>

        {/* Right Column: Transcript */}
        <Section title="Raw Transcript" icon={<FileText size={18} />} className="transcript-section">
          <div style={{ 
            maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent'
          }}>
            {isProcessing ? <ProcessingPlaceholder text="Processing transcript..." /> :
             !meeting.transcript ? <span style={{color: 'rgba(255,255,255,0.4)'}}>No transcript available.</span> :
             <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'system-ui', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
               {meeting.transcript.raw_text}
             </div>
            }
          </div>
        </Section>

      </div>
    </div>
  );
};

export default MeetingDetails;
