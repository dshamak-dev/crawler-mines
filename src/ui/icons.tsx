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
      <svg viewBox="0 0 32 32" className="glyph">
        <path d="M6 20l3-8 6 2 4-6 7 4 2 12H8z" fill="#3a322c" />
        <path d="M8 22l2-5 5 1 3-4 6 3 1 8H9z" fill="#5c534a" />
        <path d="M10 18l7 2M14 14l4 8" stroke="#1c1814" strokeWidth="1.4" fill="none" />
        <circle cx="20" cy="21" r="1.4" fill="#6a5a48" />
        <path d="M7 24h18" stroke="#2a241e" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="glyph">
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
