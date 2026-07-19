import React, { useState } from 'react';
import type { FormEvent } from 'react';
import Modal from '@/components/Modal';
import { authApi } from '@/api';

interface ChangePasswordModalProps {
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('新密碼至少需要 6 個字元');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的新密碼不一致');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ old_password: oldPassword, new_password: newPassword });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError((err as Error).message || '修改失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="修改密碼" onClose={onClose}>
      {success ? (
        <div style={{ color: 'var(--accent-color)', fontSize: '14px', padding: '8px 0' }}>
          密碼已更新
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {error && (
            <div style={{ color: 'var(--danger-color)', fontSize: '13px' }}>{error}</div>
          )}
          <input
            type="password"
            placeholder="目前密碼"
            className="glass-input"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <input
            type="password"
            placeholder="新密碼 (至少 6 個字元)"
            className="glass-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder="確認新密碼"
            className="glass-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '修改中...' : '修改密碼'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ChangePasswordModal;
