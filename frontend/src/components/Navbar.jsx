import React from 'react';
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
