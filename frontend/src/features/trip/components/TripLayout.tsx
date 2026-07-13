import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Compass, DollarSign, FileText, Home } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useTripStore } from '@/stores';
import { useTripSocket } from '../hooks/useTripSocket';
import type { TripOutletContext } from '../context';
import InviteCode from './InviteCode';

const navItemClass = ({ isActive }: { isActive: boolean }): string =>
  `bottom-nav-item ${isActive ? 'active' : ''}`;

const sideNavItemClass = ({ isActive }: { isActive: boolean }): string =>
  `side-nav-item ${isActive ? 'active' : ''}`;

const NAV_ITEMS = [
  { path: '', end: true, icon: Calendar, label: '行程規劃' },
  { path: '/expenses', end: false, icon: DollarSign, label: '記帳分帳' },
  { path: '/notes', end: false, icon: FileText, label: '備忘筆記' },
];

const TripLayout: React.FC = () => {
  const navigate = useNavigate();
  const { itineraryId: idParam } = useParams<{ itineraryId: string }>();
  const itineraryId = Number(idParam);

  const trip = useTripStore((state) => state.trip);
  const loadTrip = useTripStore((state) => state.loadTrip);
  const clear = useTripStore((state) => state.clear);
  const socket = useTripSocket(itineraryId);

  useEffect(() => {
    void loadTrip(itineraryId);
    return () => clear();
  }, [itineraryId, loadTrip, clear]);

  const context: TripOutletContext = { ...socket, itineraryId };

  return (
    <div className="trip-layout">
      {/* Desktop sidebar navigation (hidden on mobile via CSS) */}
      <aside className="side-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 16px 16px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '8px',
              background: 'var(--accent-gradient)',
              borderRadius: '12px',
              color: 'white',
            }}
          >
            <Compass size={20} />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 800 }}>趣旅遊 TripCo</span>
        </div>

        {trip && (
          <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--glass-border)', marginBottom: '8px' }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {trip.title}
            </div>
            <div style={{ marginTop: '2px' }}>
              <InviteCode code={trip.invite_code} />
            </div>
          </div>
        )}

        {NAV_ITEMS.map(({ path, end, icon: Icon, label }) => (
          <NavLink key={path} to={`/trips/${itineraryId}${path}`} end={end} className={sideNavItemClass}>
            <Icon />
            {label}
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        <button type="button" className="side-nav-item" onClick={() => navigate('/trips')}>
          <Home />
          回到首頁
        </button>
        <ThemeToggle variant="sidebar" />
      </aside>

      <div className="trip-main">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Outlet context={context} />
        </div>
      </div>

      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ path, end, icon: Icon, label }) => (
          <NavLink key={path} to={`/trips/${itineraryId}${path}`} end={end} className={navItemClass}>
            <Icon />
            {label}
          </NavLink>
        ))}
        <button type="button" className="bottom-nav-item" onClick={() => navigate('/trips')}>
          <Home />
          回到首頁
        </button>
      </nav>
    </div>
  );
};

export default TripLayout;
