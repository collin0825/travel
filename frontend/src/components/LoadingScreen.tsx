import React from 'react';

const LoadingScreen: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '16px',
      color: 'var(--text-primary)',
    }}
  >
    <div className="app-spinner" />
    <p style={{ fontSize: '15px' }}>載入中...</p>
  </div>
);

export default LoadingScreen;
