import type { ItemId } from '../engine';

export function GoldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="16" rx="8" ry="3.2" fill="#7a5416" />
      <ellipse cx="12" cy="14" rx="8" ry="3.2" fill="#e0b44a" />
      <ellipse cx="12" cy="13.2" rx="5.5" ry="1.6" fill="#f3d27a" />
      <ellipse cx="12" cy="11" rx="8" ry="3.2" fill="#c9922e" />
      <ellipse cx="12" cy="10.2" rx="5.5" ry="1.5" fill="#e8c66a" />
    </svg>
  );
}

export function ChestIcon({ wrecked = false }: { wrecked?: boolean }) {
  if (wrecked) {
    return (
      <svg viewBox="0 0 32 32" className="glyph" aria-hidden="true">
        <rect x="6" y="15" width="20" height="11" rx="2" fill="#2a2118" />
        <path d="M8 16.5h16v8.5H8z" fill="#15110d" />
        <path
          d="M5 15.5h22v10.5c0 1.2-1 2.2-2.2 2.2H7.2C6 28.2 5 27.2 5 26V15.5z"
          fill="#6b5340"
        />
        <path d="M5 15.5h22v3.2H5z" fill="#5a4534" />
        <path
          d="M7 18.2h3.2l1.4 8.8H8.2L7 18.2zm5.4 0h4.4l.4 8.8h-5.2l.4-8.8zm7.2 0H25l-1.2 8.8h-3.8l-.4-8.8z"
          fill="#8a6a40"
          opacity="0.85"
        />
        <path
          d="M12 16l2.2 5.4-1.6 6.2M19.5 16.2l-1.4 4.8 2.6 6.4M16 19v8"
          stroke="#1c1610"
          strokeWidth="1.15"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M5.2 15.2l2.2-8.4 11.2 2.4-1.6 6.4H5.2z" fill="#7a5a38" />
        <path d="M7.6 7.4l9.6 2.1-1.2 4.8H8.4L7.6 7.4z" fill="#9a7344" />
        <path
          d="M8.2 8.2l1.6 4.2M13.4 9.4l-1 5.2"
          stroke="#2a1e12"
          strokeWidth="1.1"
          fill="none"
        />
        <path d="M18.8 8.2l2.4-3.2 1.2 3.8z" fill="#8a6a40" />
        <path d="M22.6 16.2l3.4-2.8.2 4.2z" fill="#5c4630" />
        <rect
          x="19.4"
          y="21.2"
          width="3.2"
          height="4.4"
          rx="0.6"
          fill="#c9b59a"
          transform="rotate(28 21 23.4)"
        />
        <circle cx="22.4" cy="25.4" r="1.15" fill="#6b5340" />
        <path d="M6.2 27.4h19.4" stroke="#2a2118" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="glyph" aria-hidden="true">
      <rect x="5" y="14" width="22" height="12" rx="2" fill="#b8862b" />
      <path d="M5 14c0-6 4.5-9 11-9s11 3 11 9" fill="#d4a017" />
      <rect x="5" y="13" width="22" height="4" fill="#8a6419" />
      <rect x="14.2" y="12" width="3.6" height="8" rx="1" fill="#f3d27a" />
      <circle cx="16" cy="20" r="1.6" fill="#6b4a12" />
      <path d="M7 17h18" stroke="#f0d78c" strokeWidth="0.7" opacity="0.7" />
    </svg>
  );
}

export function BombIcon({ cracked = false }: { cracked?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="glyph">
      <circle cx="16" cy="18" r="9" fill="#1a1514" />
      <circle cx="16" cy="18" r="8" fill="#3b332e" />
      <circle cx="13.5" cy="15.5" r="2.2" fill="#6a5e56" />
      <rect x="14.2" y="6" width="3.6" height="5" rx="1" fill="#6b5340" />
      <path d="M16 6c2-3 6-3 7 0" stroke="#e0b44a" strokeWidth="1.4" fill="none" />
      {cracked && (
        <path
          d="M12 14l3 5-2 4m7-10l-2 6 3 3"
          stroke="#ff6b35"
          strokeWidth="1.3"
          fill="none"
        />
      )}
    </svg>
  );
}

export function FlagIcon({ ember = false }: { ember?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className="glyph">
      <path d="M10 6v20" stroke="#c9b59a" strokeWidth="2" />
      <path d="M11 7h14l-4 5 4 5H11V7z" fill={ember ? '#8b2e2e' : '#c23b3b'} />
      <path d="M11 7h10l-3 5 3 5H11" fill={ember ? '#d45a2a' : '#e25a5a'} opacity="0.85" />
    </svg>
  );
}

export function ShovelIcon() {
  return (
    <svg viewBox="0 0 32 32" className="glyph">
      <path d="M15 4h2l1 14h-4L15 4z" fill="#c9b59a" />
      <path d="M12 18h8l-1 10h-6l-1-10z" fill="#e0b44a" />
      <path d="M13 20h6" stroke="#8a6419" strokeWidth="1" />
    </svg>
  );
}

export function TorchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph">
      <path d="M10 13h4l1 9h-6l1-9z" fill="#6b5340" />
      <path d="M12 3c3 3 4 6 0 10-4-4-3-7 0-10z" fill="#ff6b35" />
      <path d="M12 6c2 2 2 4 0 7-2-3-2-5 0-7z" fill="#ffd166" />
    </svg>
  );
}

export function BagIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'glyph'} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M9 13h14l1.4 14.2c.1 1.2-.8 2.2-2 2.2H9.6c-1.2 0-2.1-1-2-2.2L9 13z"
        fill="#6b5340"
      />
      <path d="M10 14h12l1.2 13H8.8L10 14z" fill="#8a6a40" />
      <path d="M12 13c0-4 2.2-7 4-7s4 3 4 7" stroke="#c9b59a" strokeWidth="1.8" fill="none" />
      <rect x="14.2" y="18" width="3.6" height="5" rx="1" fill="#e0b44a" />
    </svg>
  );
}

function GoldPouchGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="glyph" aria-hidden="true">
      <path d="M10 14c0-3.4 2.6-6 6-6s6 2.6 6 6" fill="#c9922e" />
      <path
        d="M8.5 15.5h15v11c0 1.4-1.2 2.5-2.6 2.5H11.1c-1.4 0-2.6-1.1-2.6-2.5v-11z"
        fill="#e0b44a"
      />
      <path d="M10 16h12v3.2c-2 .8-4 1.2-6 1.2s-4-.4-6-1.2V16z" fill="#f3d27a" />
      <path d="M13 10.5h6l-1 3.5h-4z" fill="#8a6419" />
      <circle cx="16" cy="23" r="1.4" fill="#7a5416" />
    </svg>
  );
}

function KeyGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="glyph" aria-hidden="true">
      <circle cx="11" cy="12" r="5.4" fill="#8a7348" />
      <circle cx="11" cy="12" r="2.2" fill="#1a1512" />
      <path d="M15.4 13.2h12.2v3.1H24l-.2 5.4h-3.1l-.2-5.4h-2.2l-.3 3.6h-3z" fill="#a38452" />
      <path d="M8.4 10.2l1.6-1.2" stroke="#c9b59a" strokeWidth="0.9" />
    </svg>
  );
}

function CharmGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="glyph" aria-hidden="true">
      <path d="M14.2 16h3.6l1.2 11h-6z" fill="#6b5340" />
      <path d="M16 5c4 3.4 5 7 0 12-5-5-4-8.6 0-12z" fill="#ff6b35" />
      <path d="M16 8.2c2.4 2.2 2.6 4.6 0 8.2-2.6-3.6-2.4-6 0-8.2z" fill="#ffd166" />
      <circle cx="16" cy="27.4" r="1.5" fill="#e0b44a" />
    </svg>
  );
}

function GemGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="glyph" aria-hidden="true">
      <path d="M16 4.5l9 9.2-9 14.3L7 13.7z" fill="#5b3aa8" />
      <path d="M16 4.5l9 9.2H16z" fill="#8d6be0" />
      <path d="M16 4.5L7 13.7h9z" fill="#c9b4ff" />
      <path d="M7 13.7l9 14.3V13.7z" fill="#6e4cc4" />
      <path d="M16 13.7h9L16 28z" fill="#4a2d8a" />
    </svg>
  );
}

function ShardGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="glyph" aria-hidden="true">
      <path d="M15 3.8l8.4 9.6-6.6 15.4L8.2 15z" fill="#7a8a9a" />
      <path d="M15 3.8l8.4 9.6H15z" fill="#c5d0dc" />
      <path d="M15 3.8L8.2 15H15z" fill="#9aabba" />
      <path d="M15 13.4l-2.4 11.6 4.2-2.8z" fill="#e8eef4" opacity="0.7" />
    </svg>
  );
}

export function ItemIcon({ id, className }: { id: ItemId; className?: string }) {
  const glyph =
    id === 'gold-pouch' ? (
      <GoldPouchGlyph />
    ) : id === 'rusty-key' ? (
      <KeyGlyph />
    ) : id === 'torch-charm' ? (
      <CharmGlyph />
    ) : id === 'gem' ? (
      <GemGlyph />
    ) : (
      <ShardGlyph />
    );
  return className ? <span className={className}>{glyph}</span> : glyph;
}
