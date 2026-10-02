import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Key, Merge, Settings, LogOut, User, ChevronDown } from 'lucide-react';

const Sidebar = () => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'API Keys', path: '/api-keys', icon: <Key size={20} /> },
    { name: 'Merge Meetings', path: '#', icon: <Merge size={20} />, locked: true },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div style={{
      width: '260px',
      height: '100vh',
      background: 'rgba(255, 255, 255, 0.03)',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      position: 'fixed',
      left: 0,
      top: 0,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '32px', height: '32px', 
          background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', fontWeight: 'bold'
        }}>M</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', letterSpacing: '0.5px' }}>MeetInMin</h1>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.locked ? '#' : item.path}
            onClick={(e) => item.locked && e.preventDefault()}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              color: isActive && !item.locked ? '#fff' : 'rgba(255, 255, 255, 0.6)',
              background: isActive && !item.locked ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s',
              cursor: item.locked ? 'not-allowed' : 'pointer',
              opacity: item.locked ? 0.5 : 1
            })}
          >
            {item.icon}
            <span style={{ fontSize: '0.95rem' }}>{item.name}</span>
            {item.locked && (
              <span style={{ 
                marginLeft: 'auto', fontSize: '0.7rem', 
                background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' 
              }}>
                Soon
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ position: 'relative' }}>
        <button 
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            width: '100%', padding: '0.75rem',
            background: userMenuOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <User size={16} />
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>My Account</div>
          </div>
          <ChevronDown size={16} style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
        </button>

        {userMenuOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, width: '100%',
            marginBottom: '0.5rem',
            background: 'rgba(20, 20, 20, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            overflow: 'hidden',
            backdropFilter: 'blur(10px)'
          }}>
            <button 
              onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                padding: '0.75rem 1rem', background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem'
              }}
            >
              <User size={16} /> View Profile
            </button>
            <button 
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)',
                color: '#ff4b4b', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem'
              }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
