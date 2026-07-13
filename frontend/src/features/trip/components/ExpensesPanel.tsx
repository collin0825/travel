import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuthStore, useTripStore } from '@/stores';
import type { Expense } from '@/types';
import { useTripContext } from '../context';
import DebtSummary from './DebtSummary';
import AddExpenseForm from './AddExpenseForm';
import ExpenseCard from './ExpenseCard';

const ExpensesPanel: React.FC = () => {
  const { itineraryId } = useTripContext();
  const user = useAuthStore((state) => state.user);
  const trip = useTripStore((state) => state.trip);
  const debts = useTripStore((state) => state.debts);
  const refresh = useTripStore((state) => state.refresh);
  const removeExpense = useTripStore((state) => state.removeExpense);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const members = trip?.members ?? [];
  const expenses = trip?.expenses ?? [];

  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    (trip?.members ?? []).forEach((member) => map.set(member.id, member.display_name));
    return map;
  }, [trip?.members]);

  const resolveName = (userId: number): string => nameById.get(userId) ?? '未知成員';

  const handleDelete = (expenseId: number) => {
    if (!window.confirm('確定要刪除這筆花費嗎？')) return;
    void removeExpense(expenseId);
  };

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="app-header">
        <h2 style={{ fontSize: '18px', fontWeight: 800 }}>分帳與記帳</h2>
        <button
          onClick={() => void refresh()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
          }}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="content-area">
        <div className="split-layout">
          <div className="split-aside">
            <DebtSummary debts={debts} />

            {!showAddForm && !editingExpense && (
              <button
                className="btn-primary"
                onClick={() => setShowAddForm(true)}
                style={{ marginBottom: '20px' }}
              >
                <Plus size={18} />
                記一筆消費
              </button>
            )}

            {showAddForm && (
              <AddExpenseForm
                itineraryId={itineraryId}
                members={members}
                currentUserId={user?.id}
                onClose={() => setShowAddForm(false)}
              />
            )}

            {editingExpense && (
              <AddExpenseForm
                key={editingExpense.id}
                expense={editingExpense}
                itineraryId={itineraryId}
                members={members}
                currentUserId={user?.id}
                onClose={() => setEditingExpense(null)}
              />
            )}
          </div>

          <div className="split-main" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '8px 0' }}>消費明細</h3>
            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                <p>目前沒有任何花費明細</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  點選「記一筆消費」來記錄您的第一筆開銷！
                </p>
              </div>
            ) : (
              expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  resolveName={resolveName}
                  onEdit={(target) => {
                    setShowAddForm(false);
                    setEditingExpense(target);
                  }}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensesPanel;
