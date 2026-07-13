import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, LogOut, Plus, Users } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuthStore, useItinerariesStore } from '@/stores';
import type { ItinerarySummary } from '@/types';
import { useItineraryList } from '../hooks/useItineraryList';
import TripCard from './TripCard';
import CreateTripModal from './CreateTripModal';
import JoinTripModal from './JoinTripModal';

const ItineraryListPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { itineraries } = useItineraryList();
  const deleteItinerary = useItinerariesStore((state) => state.deleteItinerary);
  const leaveItinerary = useItinerariesStore((state) => state.leaveItinerary);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [editingTrip, setEditingTrip] = useState<ItinerarySummary | null>(null);

  const openTrip = (id: number) => navigate(`/trips/${id}`);

  const handleDeleteTrip = (trip: ItinerarySummary) => {
    if (!window.confirm(`確定要刪除「${trip.title}」嗎？此行程的所有景點、記帳與筆記都會一併刪除。`)) {
      return;
    }
    void deleteItinerary(trip.id);
  };

  const handleLeaveTrip = (trip: ItinerarySummary) => {
    if (!window.confirm(`確定要退出「${trip.title}」嗎？行程會保留給其他成員，之後需要邀請碼才能重新加入。`)) {
      return;
    }
    void leaveItinerary(trip.id);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Mobile stays on the default dark theme; the toggle is desktop-only. */}
      <ThemeToggle variant="floating" className="desktop-only" />

      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={
              user?.avatar_url ||
              `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.display_name}`
            }
            alt="avatar"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '2px solid var(--accent-color)',
            }}
          />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{user?.display_name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>歡迎回來</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
          }}
          title="登出"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="content-area">
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>我的旅遊行程</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            規劃與共同編輯您的假期旅程
          </p>
        </div>

        <div
          className="actions-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} />
            規劃新行程
          </button>
          <button className="btn-secondary" onClick={() => setShowJoin(true)}>
            <Users size={18} />
            輸入邀請碼
          </button>
        </div>

        {itineraries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
            <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>目前沒有任何行程</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              點選「規劃新行程」或加入朋友的行程吧！
            </p>
          </div>
        ) : (
          <div className="cards-grid">
            {itineraries.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onSelect={openTrip}
                onEdit={setEditingTrip}
                onLeave={handleLeaveTrip}
                onDelete={handleDeleteTrip}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTripModal onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />
      )}
      {editingTrip && (
        <CreateTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onCreated={() => setEditingTrip(null)}
        />
      )}
      {showJoin && (
        <JoinTripModal
          onClose={() => setShowJoin(false)}
          onJoined={(id) => {
            setShowJoin(false);
            openTrip(id);
          }}
        />
      )}
    </div>
  );
};

export default ItineraryListPage;
