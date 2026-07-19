import React, { useState } from 'react';
import { Crown, UserMinus } from 'lucide-react';
import Modal from '@/components/Modal';
import { useTripStore } from '@/stores';
import type { Member } from '@/types';

interface MembersModalProps {
  onClose: () => void;
}

const ROLE_LABELS: Record<Member['role'], string> = {
  owner: '擁有者',
  editor: '編輯者',
  viewer: '檢視者',
};

const MembersModal: React.FC<MembersModalProps> = ({ onClose }) => {
  const trip = useTripStore((state) => state.trip);
  const setMemberRole = useTripStore((state) => state.setMemberRole);
  const removeMember = useTripStore((state) => state.removeMember);
  const [error, setError] = useState('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const isOwner = trip?.my_role === 'owner';
  const members = trip?.members ?? [];

  const handleRoleChange = async (member: Member, role: 'editor' | 'viewer') => {
    setError('');
    setBusyUserId(member.id);
    try {
      await setMemberRole(member.id, role);
    } catch (err) {
      setError((err as Error).message || '更新角色失敗');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemove = async (member: Member) => {
    if (!window.confirm(`確定要將「${member.display_name}」移出此行程嗎？`)) return;
    setError('');
    setBusyUserId(member.id);
    try {
      await removeMember(member.id);
    } catch (err) {
      setError((err as Error).message || '移除成員失敗');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Modal title="行程成員" onClose={onClose}>
      {error && (
        <div style={{ color: 'var(--danger-color)', fontSize: '13px', marginBottom: '12px' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {members.map((member) => (
          <div
            key={member.id}
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <img
              src={
                member.avatar_url ||
                `https://api.dicebear.com/7.x/adventurer/svg?seed=${member.display_name}`
              }
              alt={member.display_name}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '2px solid var(--glass-border)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {member.display_name}
                {member.is_owner && <Crown size={13} color="var(--warning-color)" />}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {ROLE_LABELS[member.role]}
              </div>
            </div>
            {isOwner && !member.is_owner && (
              <>
                <select
                  className="glass-input"
                  style={{ width: '92px', padding: '6px 8px', fontSize: '13px' }}
                  value={member.role === 'viewer' ? 'viewer' : 'editor'}
                  disabled={busyUserId === member.id}
                  onChange={(e) => void handleRoleChange(member, e.target.value as 'editor' | 'viewer')}
                >
                  <option value="editor">編輯者</option>
                  <option value="viewer">檢視者</option>
                </select>
                <button
                  onClick={() => void handleRemove(member)}
                  disabled={busyUserId === member.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger-color)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  title="移除成員"
                >
                  <UserMinus size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <button className="btn-secondary" onClick={onClose} style={{ marginTop: '16px' }}>
        關閉
      </button>
    </Modal>
  );
};

export default MembersModal;
