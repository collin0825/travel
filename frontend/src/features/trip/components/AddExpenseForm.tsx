import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { DollarSign } from 'lucide-react';
import { useTripStore } from '@/stores';
import type { Expense, Member } from '@/types';

interface AddExpenseFormProps {
  itineraryId: number;
  members: Member[];
  currentUserId: number | undefined;
  /** When provided the form edits this expense instead of creating one. */
  expense?: Expense;
  onClose: () => void;
}

const AddExpenseForm: React.FC<AddExpenseFormProps> = ({
  itineraryId,
  members,
  currentUserId,
  expense,
  onClose,
}) => {
  const addExpense = useTripStore((state) => state.addExpense);
  const editExpense = useTripStore((state) => state.editExpense);

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [paidBy, setPaidBy] = useState<number>(
    expense?.paid_by ?? currentUserId ?? members[0]?.id ?? 0,
  );
  const [splitUserIds, setSplitUserIds] = useState<number[]>(
    expense?.split_user_ids ?? members.map((m) => m.id),
  );
  const [submitting, setSubmitting] = useState(false);

  const toggleSplitUser = (userId: number) => {
    setSplitUserIds((prev) => {
      if (prev.includes(userId)) {
        // Never allow splitting with nobody.
        return prev.length > 1 ? prev.filter((id) => id !== userId) : prev;
      }
      return [...prev, userId];
    });
  };

  const selectAll = () => setSplitUserIds(members.map((m) => m.id));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim() || !amount || splitUserIds.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        description,
        amount: parseFloat(amount),
        paid_by: paidBy,
        split_user_ids: splitUserIds,
      };
      if (expense) {
        await editExpense(expense.id, payload);
      } else {
        await addExpense(itineraryId, payload);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save expense:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--accent-color)' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
        {expense ? '編輯消費記錄' : '新增消費記錄'}
      </h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          placeholder="消費說明 (如：第一天晚餐、租車費)"
          className="glass-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <div style={{ position: 'relative' }}>
          <DollarSign
            size={16}
            style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }}
          />
          <input
            type="number"
            placeholder="消費金額"
            className="glass-input"
            style={{ paddingLeft: '36px' }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
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
            付款人
          </label>
          <select
            className="glass-input"
            value={paidBy}
            onChange={(e) => setPaidBy(Number(e.target.value))}
            style={{ appearance: 'none', background: 'var(--glass-bg)' }}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id} style={{ background: '#1e293b' }}>
                {member.display_name} {member.id === currentUserId ? '(我自己)' : ''}
              </option>
            ))}
          </select>
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
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>參與分帳的成員</label>
            <button
              type="button"
              onClick={selectAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              全選
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {members.map((member) => {
              const isSelected = splitUserIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleSplitUser(member.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--glass-border)'}`,
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--glass-bg)',
                    color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {member.display_name}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? '儲存中...' : '儲存'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddExpenseForm;
