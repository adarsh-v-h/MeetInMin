import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Calendar, Clock, Key, Download, 
  CheckSquare, FileText, Lightbulb, AlertCircle, Mail, ExternalLink, Edit2, Check, X
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
  let dateStr = String(dateString);
  if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-')) {
    dateStr += 'Z';
  }
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
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

// Parse a summary string into an array of clean bullet-point sentences
const parseSummaryBullets = (text) => {
  if (!text) return [];
  // First try splitting on newlines (if GLM returned multi-line)
  const byNewline = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  // Otherwise split on sentence boundaries: '. ', '! ', '? '
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/) 
    .map(s => s.trim())
    .filter(Boolean);
};

const ConfidenceBadge = ({ score, reason }) => {
  const safeScore = (score === undefined || score === null) ? 0.5 : score;
  const pct = Math.round(safeScore * 100);
  
  let color = '#3b82f6';
  let bg = 'rgba(59, 130, 246, 0.12)';
  let border = 'rgba(59, 130, 246, 0.25)';
  let label = 'Medium';

  if (pct >= 85) {
    color = '#10b981';
    bg = 'rgba(16, 185, 129, 0.12)';
    border = 'rgba(16, 185, 129, 0.3)';
    label = 'High';
  } else if (pct >= 60) {
    color = '#f59e0b';
    bg = 'rgba(245, 158, 11, 0.12)';
    border = 'rgba(245, 158, 11, 0.3)';
    label = 'Medium';
  } else {
    color = '#ef4444';
    bg = 'rgba(239, 68, 68, 0.12)';
    border = 'rgba(239, 68, 68, 0.3)';
    label = 'Low';
  }

  const tooltipText = reason ? `${pct}% ${label} Confidence: ${reason}` : `${pct}% ${label} Confidence`;

  return (
    <span 
      title={tooltipText}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        borderRadius: '12px',
        padding: '2px 8px',
        fontSize: '0.75rem',
        fontWeight: '600',
        lineHeight: '1.2',
        cursor: 'help',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
      <span>{pct}% {label}</span>
    </span>
  );
};

const SummaryBullets = ({ text, summaryJson }) => {
  let structuredBullets = null;
  if (summaryJson) {
    try {
      structuredBullets = JSON.parse(summaryJson);
    } catch (e) {
      structuredBullets = null;
    }
  }

  if (structuredBullets && Array.isArray(structuredBullets) && structuredBullets.length > 0) {
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {structuredBullets.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', flex: 1 }}>
              <span style={{
                flexShrink: 0,
                marginTop: '0.45rem',
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                display: 'block',
              }} />
              <span style={{ lineHeight: '1.65', color: 'rgba(255,255,255,0.85)' }}>{item.point || item}</span>
            </div>
            <ConfidenceBadge score={item.confidence_score} reason={item.confidence_reason} />
          </li>
        ))}
      </ul>
    );
  }

  const bullets = parseSummaryBullets(text);
  if (bullets.length <= 1) {
    return <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>{text}</div>;
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {bullets.map((bullet, i) => (
        <li key={i} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0,
            marginTop: '0.45rem',
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            display: 'block',
          }} />
          <span style={{ lineHeight: '1.65', color: 'rgba(255,255,255,0.85)' }}>{bullet}</span>
        </li>
      ))}
    </ul>
  );
};


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

// Nudge banner shown when no Gmail context was used for the analysis
const GmailNudgeBanner = () => (
  <div style={{
    background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(168,85,247,0.08))',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
  }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: '50%',
      background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0
    }}>
      <Mail size={18} color="#3b82f6" />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ margin: '0 0 0.4rem', fontWeight: '600', color: '#fff', fontSize: '0.95rem' }}>
        This analysis was based on your meeting audio alone.
      </p>
      <p style={{ margin: '0 0 0.9rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', lineHeight: '1.6' }}>
        In places where context was missing, our AI made its best guess. Connect your Gmail and
        we'll cross-reference your recent emails to fill those gaps — giving you sharper summaries
        and more accurate action items.
      </p>
      <a
        href="/settings"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '6px', padding: '0.4rem 0.85rem',
          color: '#3b82f6', fontWeight: '600', fontSize: '0.85rem',
          textDecoration: 'none', transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.25)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'}
      >
        <Mail size={14} /> Connect Gmail
      </a>
    </div>
  </div>
);

// Email context source card — attribution only, no drafts
const EmailSourceCard = ({ source }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
      <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem', flex: 1 }}>{source.subject || '(no subject)'}</div>
      <a
        href={`https://mail.google.com/mail/u/0/#all/${source.gmail_message_id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          color: '#3b82f6', fontSize: '0.78rem', textDecoration: 'none', flexShrink: 0
        }}
        title="Open in Gmail"
      >
        Open <ExternalLink size={12} />
      </a>
    </div>
    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
      From: {source.sender || 'Unknown'}
      {source.received_at && (
        <span style={{ marginLeft: '0.75rem' }}>
          · {new Date(source.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      )}
    </div>
    {source.snippet && (
      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: '1.5', fontStyle: 'italic' }}>
        "{source.snippet.slice(0, 180)}{source.snippet.length > 180 ? '…' : ''}"
      </div>
    )}
  </div>
);

const MeetingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingTranscript, setDownloadingTranscript] = useState(false);

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

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState('');

  useEffect(() => {
    if (meeting?.title) setTitleText(meeting.title);
  }, [meeting?.title]);

  const handleSaveTitle = async () => {
    const trimmed = titleText.trim();
    if (trimmed === meeting.title) {
      setIsEditingTitle(false);
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 255) {
      alert("Meeting title must be between 2 and 255 characters.");
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/v1/meetings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title: trimmed })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to update title');
      }
      setMeeting(prev => ({ ...prev, title: trimmed }));
    } catch (e) {
      alert(e.message || 'Failed to update meeting title.');
      console.error('Failed to update title:', e);
    } finally {
      setIsEditingTitle(false);
    }
  };

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
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      a.download = filenameMatch ? filenameMatch[1] : `meeting_${id}_audio.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);
    } catch(err) {
      alert("Could not download audio. The file might be processing or deleted.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadTranscript = async () => {
    try {
      setDownloadingTranscript(true);
      const response = await fetch(`http://localhost:8000/v1/meetings/${id}/transcript`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Transcript download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      a.download = filenameMatch ? filenameMatch[1] : `meeting_${id}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);
    } catch(err) {
      alert('Could not download transcript. The transcript may not be available yet.');
    } finally {
      setDownloadingTranscript(false);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {isEditingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={titleText}
                  minLength={2}
                  maxLength={255}
                  onChange={(e) => setTitleText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  autoFocus
                  style={{
                    fontSize: '1.4rem', fontWeight: 'bold', color: '#fff',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px', padding: '0.3rem 0.75rem', outline: 'none', minWidth: '300px'
                  }}
                />
                <button
                  onClick={handleSaveTitle}
                  title="Save Title"
                  style={{ background: '#10b981', border: 'none', borderRadius: '6px', padding: '0.4rem', color: '#fff', cursor: 'pointer', display: 'flex' }}
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => { setIsEditingTitle(false); setTitleText(meeting.title); }}
                  title="Cancel"
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '0.4rem', color: '#fff', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>
                  {meeting.title}
                </h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  title="Rename Meeting"
                  style={{
                    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                >
                  <Edit2 size={16} />
                </button>
              </div>
            )}

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

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isProcessing && meeting.transcript && (
            <button 
              onClick={handleDownloadTranscript}
              disabled={downloadingTranscript}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px', padding: '0.75rem 1.25rem', color: 'rgba(255,255,255,0.8)', fontWeight: '500',
                display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: downloadingTranscript ? 'wait' : 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            >
              <Download size={16} />
              {downloadingTranscript ? 'Downloading...' : 'Download Transcript'}
            </button>
          )}
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
      </div>

      {/* Grid Layout for Insights & Transcript */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start', minWidth: 0 }}>
        
        {/* Left Column: AI Intelligence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <Section title="Executive Summary" icon={<FileText size={18} color="#a855f7" />}>
            {isProcessing ? <ProcessingPlaceholder text="Generating summary..." /> : 
             !meeting.insight ? <span style={{color: 'rgba(255,255,255,0.4)'}}>No summary available.</span> :
             <SummaryBullets text={meeting.insight.summary} summaryJson={meeting.insight.summary_json} />
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
                     padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
                     justifyContent: 'space-between', alignItems: 'flex-start'
                   }}>
                     <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1 }}>
                       <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0, marginTop: '2px' }} />
                       <div>
                         <div style={{ marginBottom: '6px', color: '#fff' }}>{item.task}</div>
                         <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'inline-block', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                           Owner: {item.assignee || 'Unassigned'}
                         </div>
                       </div>
                     </div>
                     <ConfidenceBadge score={item.confidence_score} reason={item.confidence_reason} />
                   </li>
                 ))}
               </ul>
              }
            </Section>

            <Section title="Key Decisions" icon={<Lightbulb size={18} color="#f59e0b" />}>
              {isProcessing ? <ProcessingPlaceholder text="Extracting decisions..." /> : 
               !meeting.insight?.key_decisions?.length ? <span style={{color: 'rgba(255,255,255,0.4)'}}>No decisions found.</span> :
               <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                 {meeting.insight.key_decisions.map((dec, i) => (
                   <li key={i} style={{
                     display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem',
                     background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'
                   }}>
                     <span style={{ color: '#fff', lineHeight: '1.5', flex: 1 }}>{dec.decision_text}</span>
                     <ConfidenceBadge score={dec.confidence_score} reason={dec.confidence_reason} />
                   </li>
                 ))}
               </ul>
              }
            </Section>
          </div>

          {/* Email Context Sources — shown when Gmail enrichment ran */}
          {!isProcessing && meeting.status === 'completed' && (
            meeting.email_context_sources?.length > 0 ? (
              <Section title="Email Context Sources" icon={<Mail size={18} color="#3b82f6" />}>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                  The following emails were used as additional context to improve the accuracy of this analysis.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {meeting.email_context_sources.map((source) => (
                    <EmailSourceCard key={source.id} source={source} />
                  ))}
                </div>
              </Section>
            ) : (
              <GmailNudgeBanner />
            )
          )}

        </div>

        {/* Right Column: Transcript */}
        <Section 
          title="Raw Transcript"
          icon={<FileText size={18} />} 
          className="transcript-section"
        >
          <div style={{ 
            maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent'
          }}>
            {isProcessing ? <ProcessingPlaceholder text="Processing transcript..." /> :
             !meeting.transcript ? <span style={{color: 'rgba(255,255,255,0.4)'}}>No transcript available.</span> :
             <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'system-ui', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.7' }}>
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
