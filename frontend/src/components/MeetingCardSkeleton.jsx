import React from 'react';

const MeetingCardSkeleton = () => {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      height: '240px',
      backdropFilter: 'blur(10px)',
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ width: '60%', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
        <div style={{ width: '20%', height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, marginTop: '1rem' }}>
        <div style={{ width: '40%', height: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
        <div style={{ width: '30%', height: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
        <div style={{ width: '45%', height: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
      </div>

      <div style={{ 
        width: '100%', height: '40px', marginTop: '1rem', 
        background: 'rgba(255,255,255,0.03)', borderRadius: '8px' 
      }} />
    </div>
  );
};

export default MeetingCardSkeleton;
