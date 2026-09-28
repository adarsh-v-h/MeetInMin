import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';

const AppShell = () => {
  // Very basic auth check for MVP
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        marginLeft: '260px', // Matches Sidebar width
        padding: '2rem 3rem',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingLeft: 'calc(260px + 3rem)'
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
