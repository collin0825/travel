import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from '@/utils/clipboard';

interface InviteCodeProps {
  code: string;
}

/** Invite code with an inline copy button; shows 已複製 feedback after copying. */
const InviteCode: React.FC<InviteCodeProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    if (!(await copyText(code))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
      }}
    >
      邀請碼:{' '}
      <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{code}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="複製邀請碼"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          padding: '2px 4px',
          color: copied ? 'var(--success-color)' : 'var(--text-secondary)',
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        {copied ? (
          <>
            <Check size={12} />
            已複製
          </>
        ) : (
          <Copy size={12} />
        )}
      </button>
    </span>
  );
};

export default InviteCode;
