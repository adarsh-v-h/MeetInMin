import React from 'react';
import { Calendar, Clock, Key, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getStatusConfig = (status) => {
  const normalized = (status || '').toLowerCase();
  
  if (normalized === 'completed') {
    return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', text: 'Completed', isProcessing: false };
  }
  if (normalized === 'failed') {
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'Failed', isProcessing: false };
  }
  
  // Default to processing state for uploading, transcribing, analyzing, recording
  return { 
    color: '#3b82f6', 
    bg: 'rgba(59, 130, 246, 0.1)', 
    text: status.charAt(0).toUpperCase() + status.slice(1), 
    isProcessing: true 
  };
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
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

const MeetingCard = ({ meeting }) => {
  const navigate = useNavigate();
  const statusConfig = getStatusConfig(meeting.status);

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      height: '240px', // Fixed height
      backdropFilter: 'blur(10px)',
      transition: 'transform 0.2s, border-color 0.2s',
      cursor: 'default',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ 
          fontSize: '1.1rem', fontWeight: '600', color: '#fff', 
          margin: 0, 
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          lineHeight: '1.4'
        }}>
          {meeting.title || 'Untitled Meeting'}
        </h3>
        
        <div style={{
          padding: '4px 10px',
          borderRadius: '20px',
          background: statusConfig.bg,
          color: statusConfig.color,
          fontSize: '0.75rem',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          {statusConfig.isProcessing && (
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', background: statusConfig.color,
              animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }} />
          )}
          {statusConfig.text}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={14} />
          {formatDate(meeting.created_at)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={14} />
          {formatDuration(meeting.duration)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={14} />
          {meeting.api_key_name || 'Unknown Key'}
        </div>
      </div>

      <button
        onClick={() => navigate(`/meetings/${meeting.id}`)}
        style={{
          width: '100%',
          padding: '0.75rem',
          marginTop: '1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '0.9rem',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      >
        View Details
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default MeetingCard;
