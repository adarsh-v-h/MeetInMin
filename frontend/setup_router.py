import os

base_dir = "/home/venzz/Work/Projects/MeetInMin/frontend/src"
os.makedirs(os.path.join(base_dir, "pages"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "components"), exist_ok=True)

# 1. Create Navbar Component
navbar_content = """import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 }}>
      <Link to="/" style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.05em', textDecoration: 'none', color: 'var(--text-primary)' }}>
        MeetIn<span style={{ color: 'var(--accent-color)' }}>Min</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link to="/login" className="nav-link" style={{ marginRight: '1.5rem' }}>Login</Link>
        <Link to="/register" className="nav-link" style={{ marginRight: '2rem' }}>Register</Link>
        <Link to="/dashboard" className="btn-primary" style={{ padding: '0.8rem 2rem', fontSize: '1.1rem' }}>Dashboard</Link>
      </div>
    </nav>
  );
}

export default Navbar;
"""
with open(os.path.join(base_dir, "components", "Navbar.jsx"), "w") as f:
    f.write(navbar_content)

# 2. Create Register Page
register_content = """import React from 'react';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';

function Register() {
  return (
    <div className="app">
      <Navbar />
      <div className="hero" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '3rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>Create Account</h2>
          <p style={{ marginBottom: '2rem' }}>Start capturing your meetings today.</p>
          
          <form style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Using best practice autocomplete tags based on web guidance */}
            <input 
              type="text" 
              name="name"
              autoComplete="name"
              placeholder="Full Name" 
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white', fontSize: '1rem', outline: 'none' }} 
            />
            <input 
              type="email" 
              name="email"
              autoComplete="email"
              placeholder="Email Address" 
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white', fontSize: '1rem', outline: 'none' }} 
            />
            <input 
              type="password" 
              name="password"
              autoComplete="new-password"
              placeholder="Password" 
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white', fontSize: '1rem', outline: 'none' }} 
            />
            
            <button type="button" className="btn-primary" style={{ marginTop: '1rem', width: '100%' }}>Sign Up</button>
          </form>
          
          <p style={{ marginTop: '2rem', fontSize: '0.95rem' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
"""
with open(os.path.join(base_dir, "pages", "Register.jsx"), "w") as f:
    f.write(register_content)

# 3. Move App.jsx content to Landing.jsx (minus Navbar)
landing_content = """import React from 'react';
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
"""
with open(os.path.join(base_dir, "pages", "Landing.jsx"), "w") as f:
    f.write(landing_content)

# 4. Rewrite App.jsx as the Router
app_content = """import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Register from './pages/Register';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
"""
with open(os.path.join(base_dir, "App.jsx"), "w") as f:
    f.write(app_content)
