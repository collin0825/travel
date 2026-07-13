import React from 'react';
import type { PresenceUser } from '@/types';

interface PresenceBarProps {
  users: PresenceUser[];
}

const PresenceBar: React.FC<PresenceBarProps> = ({ users }) => {
  if (users.length <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        background: 'var(--glass-bg)',
        padding: '8px 12px',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
      }}
    >
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>正在共同編輯:</span>
      <div className="avatar-stack">
        {users.map((user) => (
          <img
            key={user.id}
            src={user.avatar_url}
            alt={user.display_name}
            title={user.display_name}
            className="avatar-stack-item"
          />
        ))}
      </div>
    </div>
  );
};

export default PresenceBar;
