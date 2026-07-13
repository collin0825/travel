import React from 'react';
import { ArrowRight, Compass, Lock, Mail, User } from 'lucide-react';
import { useAuthForm } from '../hooks/useAuthForm';

const iconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '14px',
  color: 'var(--text-muted)',
};

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-color)',
  fontWeight: 600,
  cursor: 'pointer',
  font: 'inherit',
};

const TITLES = {
  login: '登入帳號',
  register: '註冊新帳號',
  reset: '重設密碼',
} as const;

const SUBMIT_LABELS = {
  login: '登入',
  register: '註冊',
  reset: '重設密碼',
} as const;

const AuthForm: React.FC = () => {
  const {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    error,
    info,
    loading,
    handleSubmit,
  } = useAuthForm();

  return (
    <div
      className="content-area flex-row-center animate-slide-up"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 100px)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: '16px',
            background: 'var(--accent-gradient)',
            borderRadius: '24px',
            boxShadow: '0 8px 24px rgba(56, 189, 248, 0.3)',
            marginBottom: '16px',
            color: 'white',
          }}
        >
          <Compass size={40} />
        </div>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          趣旅遊 TripCo
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>
          即時共同編輯行程規劃 • 記帳 • 備忘錄
        </p>
      </div>

      <div className="glass-card" style={{ width: '100%', maxWidth: '360px' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          {TITLES[mode]}
        </h2>

        {mode === 'reset' && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            輸入註冊時的電子信箱與暱稱以驗證身分，即可設定新密碼
          </p>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '12px',
              color: 'var(--danger-color)',
              fontSize: '14px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {info && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '12px',
              color: 'var(--success-color)',
              fontSize: '14px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {info}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {mode !== 'login' && (
            <div style={{ position: 'relative' }}>
              <User size={18} style={iconStyle} />
              <input
                type="text"
                placeholder={mode === 'reset' ? '暱稱 (身分驗證用)' : '暱稱 (中文或英文)'}
                className="glass-input"
                style={{ paddingLeft: '44px' }}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <Mail size={18} style={iconStyle} />
            <input
              type="email"
              placeholder="電子信箱"
              className="glass-input"
              style={{ paddingLeft: '44px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={18} style={iconStyle} />
            <input
              type="password"
              placeholder={mode === 'reset' ? '新密碼 (至少 6 碼)' : '密碼'}
              className="glass-input"
              style={{ paddingLeft: '44px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'reset' ? 6 : undefined}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? '請稍後...' : SUBMIT_LABELS[mode]}
            <ArrowRight size={18} />
          </button>
        </form>

        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {mode === 'login' && (
            <>
              <span>
                還沒有帳號？{' '}
                <button type="button" style={linkButtonStyle} onClick={() => setMode('register')}>
                  立即註冊
                </button>
              </span>
              <button type="button" style={linkButtonStyle} onClick={() => setMode('reset')}>
                忘記密碼？
              </button>
            </>
          )}
          {mode === 'register' && (
            <span>
              已經有帳號？{' '}
              <button type="button" style={linkButtonStyle} onClick={() => setMode('login')}>
                立即登入
              </button>
            </span>
          )}
          {mode === 'reset' && (
            <button type="button" style={linkButtonStyle} onClick={() => setMode('login')}>
              返回登入
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
