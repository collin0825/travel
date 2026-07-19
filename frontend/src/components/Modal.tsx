import React from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  zIndex: 1000,
};

const Modal: React.FC<ModalProps> = ({ title, onClose, children, maxWidth = 360 }) => (
  <div style={overlayStyle} onClick={onClose}>
    <div
      className="glass-card"
      style={{ width: '100%', maxWidth: `${maxWidth}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>{title}</h3>
      {children}
    </div>
  </div>
);

export default Modal;
