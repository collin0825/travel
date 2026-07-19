import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import Modal from '@/components/Modal';
import { useAuthStore } from '@/stores';
import ChangePasswordModal from './ChangePasswordModal';

interface ProfileModalProps {
  onClose: () => void;
}

const avatarUrlFor = (seed: string) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;

const randomSeeds = (count: number) =>
  Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));

const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(
    user?.avatar_url || avatarUrlFor(user?.display_name ?? 'me'),
  );
  const [candidates, setCandidates] = useState<string[]>(() => randomSeeds(8));
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!displayName.trim()) {
      setError('暱稱不能為空');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim(), avatar_url: avatarUrl });
      onClose();
    } catch (err) {
      setError((err as Error).message || '儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="編輯個人資料" onClose={onClose}>
      {error && (
        <div style={{ color: 'var(--danger-color)', fontSize: '13px', marginBottom: '12px' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img
            src={avatarUrl}
            alt="目前頭像"
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              border: '3px solid var(--accent-color)',
            }}
          />
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>選擇新頭像</span>
            <button
              type="button"
              onClick={() => setCandidates(randomSeeds(8))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '2px 4px',
              }}
            >
              <RefreshCw size={12} />
              換一批
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {candidates.map((seed) => {
              const url = avatarUrlFor(seed);
              const selected = url === avatarUrl;
              return (
                <button
                  key={seed}
                  type="button"
                  onClick={() => setAvatarUrl(url)}
                  style={{
                    background: 'none',
                    border: selected
                      ? '2px solid var(--accent-color)'
                      : '2px solid var(--glass-border)',
                    borderRadius: '50%',
                    padding: '2px',
                    cursor: 'pointer',
                    lineHeight: 0,
                  }}
                >
                  <img
                    src={url}
                    alt="頭像選項"
                    style={{ width: '100%', aspectRatio: '1', borderRadius: '50%' }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            暱稱
          </label>
          <input
            type="text"
            className="glass-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowChangePassword(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <KeyRound size={16} />
          修改密碼
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </form>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </Modal>
  );
};

export default ProfileModal;
