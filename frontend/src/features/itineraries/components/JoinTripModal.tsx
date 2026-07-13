import React, { useState } from 'react';
import type { FormEvent } from 'react';
import Modal from '@/components/Modal';
import { useItinerariesStore } from '@/stores';

interface JoinTripModalProps {
  onClose: () => void;
  onJoined: (itineraryId: number) => void;
}

const JoinTripModal: React.FC<JoinTripModalProps> = ({ onClose, onJoined }) => {
  const joinItinerary = useItinerariesStore((state) => state.joinItinerary);

  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** Pasted text may carry extra words/whitespace (e.g. "邀請碼: ABC123") —
      keep only the 6 alphanumeric characters of the code itself. */
  const handleCodeChange = (value: string) => {
    setInviteCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  };

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const joined = await joinItinerary({ invite_code: inviteCode.trim() });
      onJoined(joined.id);
    } catch (err) {
      setError((err as Error).message || '加入失敗，請確認邀請碼是否正確');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="加入好友行程" onClose={onClose}>
      {error && (
        <div style={{ color: 'var(--danger-color)', fontSize: '13px', marginBottom: '12px' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          placeholder="請輸入6位數行程邀請碼"
          className="glass-input"
          style={{
            textTransform: 'uppercase',
            textAlign: 'center',
            fontSize: '20px',
            letterSpacing: '4px',
          }}
          value={inviteCode}
          onChange={(e) => handleCodeChange(e.target.value)}
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
            {loading ? '驗證中...' : '加入行程'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default JoinTripModal;
