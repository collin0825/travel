import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Expense } from '@/types';

interface ExpenseCardProps {
  expense: Expense;
  resolveName: (userId: number) => string;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: number) => void;
}

const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, resolveName, onEdit, onDelete }) => (
  <div
    className="glass-card"
    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
  >
    <div>
      <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{expense.description}</h4>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginTop: '4px',
        }}
      >
        <span>付款人: {resolveName(expense.paid_by)}</span>
        <span>•</span>
        <span>分攤者: {expense.split_user_ids.map(resolveName).join(', ')}</span>
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)' }}>
          ${expense.amount}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
          每人 ${Math.round((expense.amount / expense.split_user_ids.length) * 100) / 100}
        </div>
      </div>
      <button
        onClick={() => onEdit(expense)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
        }}
      >
        <Pencil size={16} />
      </button>
      <button
        onClick={() => onDelete(expense.id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
        }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
);

export default ExpenseCard;
