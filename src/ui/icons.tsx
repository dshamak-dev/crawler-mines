import type { ChestTier, ItemId } from '../engine';

const TIER_PAINT: Record<
  ChestTier,
  { body: string; lid: string; band: string; latch: string; shine: string; wreck: string }
> = {
  wooden: {
    body: '#8a6234',
    lid: '#a07440',
    band: '#5a4534',
    latch: '#c9b59a',
    shine: '#c4a06a',
    wreck: '#7a5a38',
  },
  iron: {
    body: '#6a7380',
    lid: '#8a93a0',
    band: '#3a4048',
    latch: '#c5d0dc',
    shine: '#b8c4d0',
    wreck: '#5c6570',
  },
  gilded: {
    body: '#b8862b',
    lid: '#d4a017',
    band: '#8a6419',
    latch: '#f3d27a',
    shine: '#f0d78c',
    wreck: '#8a6a40',
  },
};

export function ChestIcon({
  wrecked = false,
  tier = 'gilded',
  className,
}: {
  wrecked?: boolean;
  tier?: ChestTier;
  className?: string;
}) {
  const svgClass = className ?? 'glyph';
  const p = TIER_PAINT[tier];
  if (wrecked) {
    return (
      <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
        <rect x="6" y="15" width="20" height="10" rx="1.5" fill="#1a1410" />
        <rect x="5" y="14" width="22" height="12" rx="2" fill={p.wreck} />
        <rect x="5" y="14" width="22" height="3.6" fill={p.band} />
        <path d="M7 19h18M7 23h18" stroke="#3a2a1c" strokeWidth="1.05" />
        <path
          d="M12 14.4l2.4 5.2-1.8 6.2M20 15l-1.2 5.4 2.4 5.4"
          stroke="#1c1610"
          strokeWidth="1.35"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M5 13.2c.2-5.6 4.4-8.6 10.4-8.8 4.8-.2 8.6 1.8 10.2 5.6l-4.4 1.6c-.8-1.8-3-2.8-6-2.6-3.6.2-6.2 2-6.4 4.6H5z"
          fill={p.lid}
        />
        <path
          d="M15.2 5.2l1.2 4.8 2.4 2.2"
          stroke="#2a1e12"
          strokeWidth="1.15"
          fill="none"
        />
        <path d="M23.6 11.2l3.2-3.6.6 4.6z" fill={p.wreck} />
        <path d="M24.2 14.2l3.4 1.2-1.2 3.2z" fill={p.band} />
        <rect
          x="19.6"
          y="19.2"
          width="3.2"
          height="6.2"
          rx="0.7"
          fill={p.latch}
          transform="rotate(32 21.2 22.3)"
        />
        <circle cx="22.2" cy="24.8" r="1.15" fill="#4a3828" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={svgClass} aria-hidden="true">
      <rect x="5" y="14" width="22" height="12" rx="2" fill={p.body} />
      <path d="M5 14c0-6 4.5-9 11-9s11 3 11 9" fill={p.lid} />
      <rect x="5" y="13" width="22" height="4" fill={p.band} />
      <rect x="14.2" y="12" width="3.6" height="8" rx="1" fill={p.latch} />
      <circle cx="16" cy="20" r="1.6" fill="#6b4a12" />
      <path d="M7 17h18" stroke={p.shine} strokeWidth="0.7" opacity="0.7" />
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

export function GoldIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'glyph'} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="16" rx="8" ry="3.2" fill="#7a5416" />
      <ellipse cx="12" cy="14" rx="8" ry="3.2" fill="#e0b44a" />
      <ellipse cx="12" cy="13.2" rx="5.5" ry="1.6" fill="#f3d27a" />
      <ellipse cx="12" cy="11" rx="8" ry="3.2" fill="#c9922e" />
      <ellipse cx="12" cy="10.2" rx="5.5" ry="1.5" fill="#e8c66a" />
    </svg>
  );
}

export function BagIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'glyph'} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11.2 6.2v7.2M20.8 6.2v7.2" stroke="#c9b59a" strokeWidth="2.3" strokeLinecap="round" />
      <rect x="6.5" y="11.2" width="19" height="17.2" rx="3.4" fill="#5a4534" />
      <rect x="7.8" y="12.4" width="16.4" height="14.8" rx="2.6" fill="#8a6a40" />
      <rect x="6.5" y="11.2" width="19" height="6.4" rx="2.8" fill="#6b5340" />
      <rect x="11.4" y="20.2" width="9.2" height="5.4" rx="1.3" fill="#5a4534" />
      <rect x="14.4" y="14.6" width="3.2" height="2.2" rx="0.5" fill="#e0b44a" />
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

export function SpeakerIcon({
  muted = false,
  className,
}: {
  muted?: boolean;
  className?: string;
}) {
  return (
    <svg className={className ?? 'glyph'} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6.5 12.2h5.2L18 7.4v17.2l-6.3-4.8H6.5z" fill="#c9b59a" />
      {muted ? (
        <path
          d="M21.2 12.2l7.2 7.2M28.4 12.2l-7.2 7.2"
          stroke="#e07a6a"
          strokeWidth="2.1"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <>
          <path
            d="M21.4 11.2c1.8 1.6 1.8 8 0 9.6"
            stroke="#e0b44a"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M24.6 8.4c3.4 3.2 3.4 12 0 15.2"
            stroke="#e0b44a"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
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
