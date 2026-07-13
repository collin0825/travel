import React from 'react';
import { Users } from 'lucide-react';
import type { Debt } from '@/types';

interface DebtSummaryProps {
  debts: Debt[];
}

const DebtSummary: React.FC<DebtSummaryProps> = ({ debts }) => (
  <div
    className="glass-card"
    style={{
      marginBottom: '20px',
      background: 'rgba(56, 189, 248, 0.08)',
      border: '1px solid rgba(56, 189, 248, 0.2)',
    }}
  >
    <h3
      style={{
        fontSize: '15px',
        fontWeight: 700,
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <Users size={16} style={{ color: 'var(--accent-color)' }} />
      債務結算分析 (最簡還款)
    </h3>
    {debts.length === 0 ? (
      <p style={{ color: 'var(--success-color)', fontSize: '13px', fontWeight: 600 }}>
        🎉 所有款項皆已結清，沒有人欠錢！
      </p>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {debts.map((debt, index) => (
          <div
            key={`${debt.from_user.id}-${debt.to_user.id}-${index}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          >
            <span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {debt.from_user.display_name}
              </span>
              <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>應給</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {debt.to_user.display_name}
              </span>
            </span>
            <span style={{ fontWeight: 800, color: 'var(--accent-color)' }}>${debt.amount} 元</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default DebtSummary;
