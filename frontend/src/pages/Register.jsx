import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Link, useNavigate } from 'react-router-dom';

function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const EyeIcon = ({ show }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
      {show ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </>
      )}
    </svg>
  );

  const inputContainerStyle = { position: 'relative', width: '100%' };
  const inputStyle = { width: '100%', padding: '1rem', paddingRight: '3rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white', fontSize: '1rem', outline: 'none' };
  const iconButtonStyle = { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex' };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirm_password) {
      return setError('Passwords do not match');
    }
    
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      
      navigate('/login?registered=true');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = "http://localhost:8000/v1/auth/login/google";
  };

  return (
    <div className="app">
      <Navbar />
      <div className="hero" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '6rem', paddingBottom: '2rem' }}>
        <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', maxWidth: '1000px', overflow: 'hidden', padding: 0 }}>
          
          <div style={{ padding: '4rem 3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>Create Account</h2>
            <p style={{ marginBottom: '2rem' }}>Start capturing your meetings today.</p>
            
            {error && <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: '8px', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.3)', color: '#ff453a' }}>{error}</div>}
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={inputContainerStyle}>
                <input type="text" name="username" value={formData.username} onChange={handleChange} required autoComplete="username" placeholder="Username" style={inputStyle} />
              </div>
              
              <div style={inputContainerStyle}>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required autoComplete="email" placeholder="Email Address" style={inputStyle} />
              </div>
              
              <div style={inputContainerStyle}>
                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required autoComplete="new-password" placeholder="Password" style={inputStyle} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={iconButtonStyle}>
                  <EyeIcon show={showPassword} />
                </button>
              </div>

              <div style={inputContainerStyle}>
                <input type={showConfirmPassword ? "text" : "password"} name="confirm_password" value={formData.confirm_password} onChange={handleChange} required autoComplete="new-password" placeholder="Confirm Password" style={inputStyle} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={iconButtonStyle}>
                  <EyeIcon show={showConfirmPassword} />
                </button>
              </div>
              
              <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '0.5rem', width: '100%', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
              <span style={{ padding: '0 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
            </div>

            <button type="button" onClick={handleGoogleAuth} style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'white', color: 'black', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign up with Google
            </button>
            
            <p style={{ marginTop: '1.5rem', fontSize: '0.95rem' }}>
              Already have an account? <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>Log In</Link>
            </p>
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.15) 100%)', borderLeft: '1px solid var(--glass-border)', padding: '4rem 3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <h3 style={{ fontSize: '2.2rem', marginBottom: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Supercharge your workflow.</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.1rem' }}>Join thousands of professionals saving hours every week with automated meeting minutes and instantly delegated action items.</p>
            <img src="/ai-waves.png" alt="AI Engine" style={{ width: '100%', maxWidth: '320px', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))', transform: 'scale(1.1)' }} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default Register;
