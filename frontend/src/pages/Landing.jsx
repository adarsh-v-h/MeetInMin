import React from 'react';
import Navbar from '../components/Navbar';

function Landing() {
  return (
    <div className="app">
      <Navbar />

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-container">
          <div className="hero-content">
            <h1>Be Present.<br/>We'll Take the Notes.</h1>
            <p>
              MeetInMin silently records your browser audio, analyzes the transcript, and automates your follow-ups. No awkward bots joining your calls.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary" style={{ fontSize: '1.1rem' }}>Install Chrome Extension</button>
              <button className="btn-secondary" style={{ fontSize: '1.1rem' }}>View Demo</button>
            </div>
            
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-val">99%</span>
                <span className="stat-label">Accuracy</span>
              </div>
              <div className="stat">
                <span className="stat-val">10x</span>
                <span className="stat-label">Faster Follow-ups</span>
              </div>
            </div>
          </div>
          
          <div className="hero-visual">
            <img src="/gmeet.png" alt="Google Meet Background" className="mockup-base" />
            <img src="/extension-ui.png" alt="Extension UI" className="mockup-float" />
          </div>
        </div>
      </section>

      {/* How it Works / Bento Grid */}
      <section className="bento-section">
        <div className="container">
          <div className="section-header">
            <h2>The Invisible Workflow</h2>
            <p>Designed to be completely frictionless. Set it and forget it.</p>
          </div>

          <div className="bento-grid">
            
            <div className="glass-panel bento-large bento-card">
              <h3>1. Silent Tab Capture</h3>
              <p>Unlike competitors that force an awkward bot to join your meeting, our extension silently captures high-fidelity audio directly from your browser tab.</p>
              <img src="/gmeet.png" alt="Capture UI" className="card-image" style={{ height: '250px' }} />
            </div>

            <div className="glass-panel bento-small bento-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)' }}>
              <h3>2. Neural Analysis</h3>
              <p>Powered by Zoho Catalyst STT and Google Gemini 1.5 Flash, processing hours of audio in seconds.</p>
              <img src="/ai-waves.png" alt="AI Waves" className="card-image" style={{ objectFit: 'contain', marginTop: 'auto' }} />
            </div>

            <div className="glass-panel bento-full">
              <div className="content">
                <h3>3. Automated Follow-ups</h3>
                <p>
                  As soon as you hang up, Meeting Minutes and Action Items are already in your dashboard. 
                  Connect your Google Workspace to instantly route Action Items to your team via Gmail.
                </p>
                <button className="btn-primary" style={{ marginTop: '1rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>View Dashboard Example</button>
              </div>
              <div className="image-container">
                <img src="/email.png" alt="Gmail Followup" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '4rem 0', textAlign: 'center', marginTop: '4rem' }}>
        <div className="container">
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>
            MeetIn<span style={{ color: 'var(--accent-color)' }}>Min</span>
          </div>
          <p style={{ margin: 0 }}>© 2026 MeetInMin. Built with React & FastAPI.</p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
