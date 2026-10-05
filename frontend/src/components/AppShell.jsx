import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const AppShell = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const urlToken = searchParams.get('token');
  
  // Initialize token from localStorage or from URL if just redirected
  const [token, setToken] = useState(() => localStorage.getItem('token') || urlToken);

  useEffect(() => {
    // If we just got a token from the Google login redirect, save it and clean the URL
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      navigate(location.pathname, { replace: true });
    }
  }, [urlToken, navigate, location.pathname]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        minWidth: 0,
        marginLeft: '260px',
        padding: '2rem 2.5rem',
        overflowX: 'hidden',
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
