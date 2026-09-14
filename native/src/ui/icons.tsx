import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import {
  flagSkinPaint,
  gridSkinPaint,
  isFlagSkinId,
  type BossId,
  type ChestTier,
  type FlagSkinId,
  type GridSkinId,
  type ItemId,
  type SkinId,
} from '../../../src/engine';

type GlyphProps = { size?: number; color?: string };

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
  rare: {
    body: '#4a2d6a',
    lid: '#6b3d8a',
    band: '#2a1840',
    latch: '#e0b44a',
    shine: '#c9b4ff',
    wreck: '#3a2850',
  },
  secret: {
    body: '#2c221c',
    lid: '#4a3226',
    band: '#8a4a22',
    latch: '#d4923a',
    shine: '#e8b060',
    wreck: '#241810',
  },
};

export function ChestIcon({
  wrecked = false,
  tier = 'gilded',
  size = 24,
}: {
  wrecked?: boolean;
  tier?: ChestTier;
  size?: number;
}) {
  const p = TIER_PAINT[tier];
  if (wrecked) {
    return (
      <Svg viewBox="0 0 32 32" width={size} height={size}>
        <Rect x="6" y="15" width="20" height="10" rx="1.5" fill="#1a1410" />
        <Rect x="5" y="14" width="22" height="12" rx="2" fill={p.wreck} />
        <Rect x="5" y="14" width="22" height="3.6" fill={p.band} />
        <Path d="M7 19h18M7 23h18" stroke="#3a2a1c" strokeWidth="1.05" />
        <Path
          d="M12 14.4l2.4 5.2-1.8 6.2M20 15l-1.2 5.4 2.4 5.4"
          stroke="#1c1610"
          strokeWidth="1.35"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M5 13.2c.2-5.6 4.4-8.6 10.4-8.8 4.8-.2 8.6 1.8 10.2 5.6l-4.4 1.6c-.8-1.8-3-2.8-6-2.6-3.6.2-6.2 2-6.4 4.6H5z"
          fill={p.lid}
        />
        <Path d="M15.2 5.2l1.2 4.8 2.4 2.2" stroke="#2a1e12" strokeWidth="1.15" fill="none" />
        <Path d="M23.6 11.2l3.2-3.6.6 4.6z" fill={p.wreck} />
        <Path d="M24.2 14.2l3.4 1.2-1.2 3.2z" fill={p.band} />
        <Rect x="19.6" y="19.2" width="3.2" height="6.2" rx="0.7" fill={p.latch} transform="rotate(32 21.2 22.3)" />
        <Circle cx="22.2" cy="24.8" r="1.15" fill="#4a3828" />
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Rect x="5" y="14" width="22" height="12" rx="2" fill={p.body} />
      <Path d="M5 14c0-6 4.5-9 11-9s11 3 11 9" fill={p.lid} />
      <Rect x="5" y="13" width="22" height="4" fill={p.band} />
      <Rect x="14.2" y="12" width="3.6" height="8" rx="1" fill={p.latch} />
      {tier === 'secret' ? (
        <Circle cx="16" cy="20.2" r="2.05" fill="#1a1210" />
      ) : (
        <Circle cx="16" cy="20" r="1.6" fill="#6b4a12" />
      )}
      <Path d="M7 17h18" stroke={p.shine} strokeWidth="0.7" opacity="0.7" />
    </Svg>
  );
}

export function BombIcon({ cracked = false, size = 24 }: { cracked?: boolean; size?: number }) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Circle cx="16" cy="18" r="9" fill="#1a1514" />
      <Circle cx="16" cy="18" r="8" fill="#3b332e" />
      <Circle cx="13.5" cy="15.5" r="2.2" fill="#6a5e56" />
      <Rect x="14.2" y="6" width="3.6" height="5" rx="1" fill="#6b5340" />
      <Path d="M16 6c2-3 6-3 7 0" stroke="#e0b44a" strokeWidth="1.4" fill="none" />
      {cracked ? (
        <Path d="M12 14l3 5-2 4m7-10l-2 6 3 3" stroke="#ff6b35" strokeWidth="1.3" fill="none" />
      ) : null}
    </Svg>
  );
}

export function FlagIcon({
  ember = false,
  size = 24,
  skin = 'flag-red',
}: {
  ember?: boolean;
  size?: number;
  skin?: FlagSkinId;
}) {
  const paint = flagSkinPaint(skin);
  const cloth = ember ? '#8b2e2e' : paint.cloth;
  const shine = ember ? '#d45a2a' : paint.shine;
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M10 6v20" stroke={paint.pole} strokeWidth="2" />
      <Path d="M11 7h14l-4 5 4 5H11V7z" fill={cloth} />
      <Path d="M11 7h10l-3 5 3 5H11" fill={shine} opacity="0.85" />
      {paint.mark === 'skull' ? (
        <>
          <Circle cx="17.2" cy="10.6" r="2.15" fill="#e8dcc8" />
          <Path
            d="M15.4 13.8l4 3M19.4 13.8l-4 3"
            stroke="#e8dcc8"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </Svg>
  );
}

export function GridSkinIcon({ id, size = 24 }: { id: GridSkinId; size?: number }) {
  const paint = gridSkinPaint(id);
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Rect x="3" y="3" width="12" height="12" rx="2" fill={paint.hidden} />
      <Rect x="17" y="3" width="12" height="12" rx="2" fill={paint.revealed} />
      <Rect x="3" y="17" width="12" height="12" rx="2" fill={paint.chest} />
      <Rect x="17" y="17" width="12" height="12" rx="2" fill={paint.hidden} />
    </Svg>
  );
}

export function SkinIcon({ id, size = 24 }: { id: SkinId; size?: number }) {
  if (isFlagSkinId(id)) return <FlagIcon skin={id} size={size} />;
  return <GridSkinIcon id={id} size={size} />;
}

export function HeartIcon({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path
        d="M16 27.2c-1.2 0-2.2-.5-8.2-6.2C3.4 16.4 4.2 10.2 8.6 8.2c2.6-1.2 5.2-.2 7.4 2.2 2.2-2.4 4.8-3.4 7.4-2.2 4.4 2 5.2 8.2.8 12.8-6 5.7-7 6.2-8.2 6.2z"
        fill="#4a1024"
      />
      <Path
        d="M16 25.4c-1 0-1.8-.4-7.2-5.5C5.2 16.2 5.8 11.2 9.2 9.6c2.1-1 4.3-.1 6.1 2.1l.7.8.7-.8c1.8-2.2 4-3.1 6.1-2.1 3.4 1.6 4 6.6.4 10.3-5.4 5.1-6.2 5.5-7.2 5.5z"
        fill="#c43a5c"
      />
      <Path d="M10.2 11.2c1.6-1.4 3.6-.8 5.2 1.2" stroke="#f6b4c4" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function DoorIcon({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M8 28V12.5c0-4.6 3.4-8.2 8-8.2s8 3.6 8 8.2V28z" fill="#3a322c" />
      <Path d="M9.4 27.2V12.8c0-3.8 2.8-6.8 6.6-6.8s6.6 3 6.6 6.8v14.4z" fill="#1a1210" />
      <Path d="M9.4 12.8c0-3.8 2.8-6.8 6.6-6.8s6.6 3 6.6 6.8" stroke="#c9b59a" strokeWidth="1.4" fill="none" />
      <Path d="M8 27.2h16" stroke="#5a4a3c" strokeWidth="1.6" strokeLinecap="round" />
      <Circle cx="19.4" cy="18.6" r="1.15" fill="#e0b44a" />
    </Svg>
  );
}

export function ShovelIcon({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M15 4h2l1 14h-4L15 4z" fill="#c9b59a" />
      <Path d="M12 18h8l-1 10h-6l-1-10z" fill="#e0b44a" />
      <Path d="M13 20h6" stroke="#8a6419" strokeWidth="1" />
    </Svg>
  );
}

export function TorchIcon({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M10 13h4l1 9h-6l1-9z" fill="#6b5340" />
      <Path d="M12 3c3 3 4 6 0 10-4-4-3-7 0-10z" fill="#ff6b35" />
      <Path d="M12 6c2 2 2 4 0 7-2-3-2-5 0-7z" fill="#ffd166" />
    </Svg>
  );
}

export function GoldIcon({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Ellipse cx="12" cy="16" rx="8" ry="3.2" fill="#7a5416" />
      <Ellipse cx="12" cy="14" rx="8" ry="3.2" fill="#e0b44a" />
      <Ellipse cx="12" cy="13.2" rx="5.5" ry="1.6" fill="#f3d27a" />
      <Ellipse cx="12" cy="11" rx="8" ry="3.2" fill="#c9922e" />
      <Ellipse cx="12" cy="10.2" rx="5.5" ry="1.5" fill="#e8c66a" />
    </Svg>
  );
}

export function ScalesIcon({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M15.2 4.6h1.6v18.6" stroke="#c9b59a" strokeWidth="2.1" strokeLinecap="round" />
      <Path d="M9.2 25.2h13.6v2.4H9.2z" fill="#6b5340" />
      <Path d="M11.4 25.2h9.2v-2.2h-9.2z" fill="#8a6a40" />
      <Path d="M16 6.4L7.6 15.2h16.8z" fill="none" stroke="#e0b44a" strokeWidth="1.7" strokeLinejoin="round" />
      <Path d="M7.6 15.2c0 2.8 1.8 4.6 4.4 4.6s4.4-1.8 4.4-4.6" fill="#c9922e" />
      <Path d="M15.6 15.2c0 2.8 1.8 4.6 4.4 4.6s4.4-1.8 4.4-4.6" fill="#c9922e" />
      <Path d="M8.8 15.6h6.4" stroke="#f3d27a" strokeWidth="0.8" opacity="0.7" />
      <Path d="M16.8 15.6h6.4" stroke="#f3d27a" strokeWidth="0.8" opacity="0.7" />
      <Circle cx="16" cy="6.4" r="1.6" fill="#e0b44a" />
    </Svg>
  );
}

export function BagIcon({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M11.2 6.2v7.2M20.8 6.2v7.2" stroke="#c9b59a" strokeWidth="2.3" strokeLinecap="round" />
      <Rect x="6.5" y="11.2" width="19" height="17.2" rx="3.4" fill="#5a4534" />
      <Rect x="7.8" y="12.4" width="16.4" height="14.8" rx="2.6" fill="#8a6a40" />
      <Rect x="6.5" y="11.2" width="19" height="6.4" rx="2.8" fill="#6b5340" />
      <Rect x="11.4" y="20.2" width="9.2" height="5.4" rx="1.3" fill="#5a4534" />
      <Rect x="14.4" y="14.6" width="3.2" height="2.2" rx="0.5" fill="#e0b44a" />
    </Svg>
  );
}

export function MenuIcon({ size = 24, color = '#f3e6d0' }: GlyphProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M4.5 7h15M4.5 12h15M4.5 17h15" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function GoldPouchGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M10 14c0-3.4 2.6-6 6-6s6 2.6 6 6" fill="#c9922e" />
      <Path d="M8.5 15.5h15v11c0 1.4-1.2 2.5-2.6 2.5H11.1c-1.4 0-2.6-1.1-2.6-2.5v-11z" fill="#e0b44a" />
      <Path d="M10 16h12v3.2c-2 .8-4 1.2-6 1.2s-4-.4-6-1.2V16z" fill="#f3d27a" />
      <Path d="M13 10.5h6l-1 3.5h-4z" fill="#8a6419" />
      <Circle cx="16" cy="23" r="1.4" fill="#7a5416" />
    </Svg>
  );
}

function KeyGlyph({
  body = '#a38452',
  ring = '#8a7348',
  size = 24,
}: {
  body?: string;
  ring?: string;
  size?: number;
}) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Circle cx="11" cy="12" r="5.4" fill={ring} />
      <Circle cx="11" cy="12" r="2.2" fill="#1a1512" />
      <Path d="M15.4 13.2h12.2v3.1H24l-.2 5.4h-3.1l-.2-5.4h-2.2l-.3 3.6h-3z" fill={body} />
      <Path d="M8.4 10.2l1.6-1.2" stroke="#c9b59a" strokeWidth="0.9" />
    </Svg>
  );
}

function CharmGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M14.2 16h3.6l1.2 11h-6z" fill="#6b5340" />
      <Path d="M16 5c4 3.4 5 7 0 12-5-5-4-8.6 0-12z" fill="#ff6b35" />
      <Path d="M16 8.2c2.4 2.2 2.6 4.6 0 8.2-2.6-3.6-2.4-6 0-8.2z" fill="#ffd166" />
      <Circle cx="16" cy="27.4" r="1.5" fill="#e0b44a" />
    </Svg>
  );
}

function GemGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M16 4.5l9 9.2-9 14.3L7 13.7z" fill="#5b3aa8" />
      <Path d="M16 4.5l9 9.2H16z" fill="#8d6be0" />
      <Path d="M16 4.5L7 13.7h9z" fill="#c9b4ff" />
      <Path d="M7 13.7l9 14.3V13.7z" fill="#6e4cc4" />
      <Path d="M16 13.7h9L16 28z" fill="#4a2d8a" />
    </Svg>
  );
}

function ShardGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M15 3.8l8.4 9.6-6.6 15.4L8.2 15z" fill="#7a8a9a" />
      <Path d="M15 3.8l8.4 9.6H15z" fill="#c5d0dc" />
      <Path d="M15 3.8L8.2 15H15z" fill="#9aabba" />
      <Path d="M15 13.4l-2.4 11.6 4.2-2.8z" fill="#e8eef4" opacity="0.7" />
    </Svg>
  );
}

export function SpeakerIcon({ muted = false, size = 24 }: { muted?: boolean; size?: number }) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M6.5 12.2h5.2L18 7.4v17.2l-6.3-4.8H6.5z" fill="#c9b59a" />
      {muted ? (
        <Path d="M21.2 12.2l7.2 7.2M28.4 12.2l-7.2 7.2" stroke="#e07a6a" strokeWidth="2.1" strokeLinecap="round" fill="none" />
      ) : (
        <>
          <Path d="M21.4 11.2c1.8 1.6 1.8 8 0 9.6" stroke="#e0b44a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <Path d="M24.6 8.4c3.4 3.2 3.4 12 0 15.2" stroke="#e0b44a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

export function BossIcon({ id = 'gluttony', size = 24 }: { id?: BossId; size?: number }) {
  if (id === 'lust') {
    return (
      <Svg viewBox="0 0 32 32" width={size} height={size}>
        <Path
          d="M16 27.2c-1.2 0-2.2-.5-8.2-6.2C3.4 16.4 4.2 10.2 8.6 8.2c2.6-1.2 5.2-.2 7.4 2.2 2.2-2.4 4.8-3.4 7.4-2.2 4.4 2 5.2 8.2.8 12.8-6 5.7-7 6.2-8.2 6.2z"
          fill="#4a1024"
        />
        <Path
          d="M16 25.4c-1 0-1.8-.4-7.2-5.5C5.2 16.2 5.8 11.2 9.2 9.6c2.1-1 4.3-.1 6.1 2.1l.7.8.7-.8c1.8-2.2 4-3.1 6.1-2.1 3.4 1.6 4 6.6.4 10.3-5.4 5.1-6.2 5.5-7.2 5.5z"
          fill="#c43a5c"
        />
        <Path d="M10.2 11.2c1.6-1.4 3.6-.8 5.2 1.2" stroke="#f6b4c4" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <Circle cx="13.2" cy="16.4" r="1.55" fill="#1a1014" />
        <Circle cx="18.8" cy="16.4" r="1.55" fill="#1a1014" />
        <Circle cx="13.6" cy="16" r="0.55" fill="#f6d27a" />
        <Circle cx="19.2" cy="16" r="0.55" fill="#f6d27a" />
        <Path d="M13.6 20.2c.8 1.2 2 1.8 2.4 1.8s1.6-.6 2.4-1.8" stroke="#1a1014" strokeWidth="1.15" fill="none" strokeLinecap="round" />
      </Svg>
    );
  }
  if (id === 'wrath') {
    return (
      <Svg viewBox="0 0 32 32" width={size} height={size}>
        <Ellipse cx="16" cy="19" rx="11.2" ry="9.2" fill="#4a1210" />
        <Ellipse cx="16" cy="17.4" rx="10.4" ry="8.4" fill="#a32a22" />
        <Path d="M7.2 16.4c1.8-4.6 4.6-7.2 8.8-7.2s7 2.6 8.8 7.2" fill="#c43b30" />
        <Path d="M8.4 8.2l-2.6-4.6 3.2-.4 2.2 4.2z" fill="#e0b44a" />
        <Path d="M23.6 8.2l2.6-4.6-3.2-.4-2.2 4.2z" fill="#e0b44a" />
        <Circle cx="12.2" cy="16.2" r="2.3" fill="#1a1014" />
        <Circle cx="19.8" cy="16.2" r="2.3" fill="#1a1014" />
        <Circle cx="12.7" cy="15.7" r="0.85" fill="#f6d27a" />
        <Circle cx="20.3" cy="15.7" r="0.85" fill="#f6d27a" />
        <Path d="M11.4 21.4h9.2l-1.2 3.2h-6.8z" fill="#1a1014" />
        <Path d="M12.4 21.4l1.6 2.6 1.4-2 1.4 2 1.6-2.6" stroke="#f6d27a" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Ellipse cx="16" cy="19" rx="11.2" ry="9.2" fill="#3a1848" />
      <Ellipse cx="16" cy="17.4" rx="10.4" ry="8.4" fill="#6b2d7a" />
      <Path d="M7.2 16.4c1.8-4.6 4.6-7.2 8.8-7.2s7 2.6 8.8 7.2" fill="#8a3d98" />
      <Circle cx="12.2" cy="16.2" r="2.3" fill="#1a1014" />
      <Circle cx="19.8" cy="16.2" r="2.3" fill="#1a1014" />
      <Circle cx="12.7" cy="15.7" r="0.85" fill="#f3e6d0" />
      <Circle cx="20.3" cy="15.7" r="0.85" fill="#f3e6d0" />
      <Path d="M11.2 21.2h9.6s-.4 3.4-4.8 3.4-4.8-3.4-4.8-3.4z" fill="#1a1014" />
      <Path d="M12.2 21.2l1.4 2.2 1.4-2.2 1.4 2.2 1.4-2.2 1.4 2.2" stroke="#f3e6d0" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
      <Path d="M21.6 8.2l2.4-4.2 2.2 1.1-1.6 4.4z" fill="#c23b3b" />
      <Path d="M22.4 9.4h5.2v1.5h-5.2z" fill="#e0b44a" />
    </Svg>
  );
}

function MedalGlyph({ metal, shine, rim, size = 24 }: { metal: string; shine: string; rim: string; size?: number }) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M11.2 5.2h9.6l-1.4 5.2h-6.8z" fill="#6b5340" />
      <Path d="M12.4 5.2h7.2l-1 3.6h-5.2z" fill="#c9b59a" />
      <Circle cx="16" cy="19.2" r="8.6" fill={rim} />
      <Circle cx="16" cy="19.2" r="7.2" fill={metal} />
      <Ellipse cx="13.6" cy="16.4" rx="2.4" ry="1.6" fill={shine} opacity="0.85" />
      <Circle cx="16" cy="19.4" r="2.6" fill={shine} opacity="0.45" />
      <Path
        d="M16 16.6l.7 1.5 1.6.2-1.2 1.1.3 1.6L16 20.2l-1.4.8.3-1.6-1.2-1.1 1.6-.2z"
        fill={rim}
        opacity="0.55"
      />
    </Svg>
  );
}

function GoldCupGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M10.2 6.4h11.6v2.2H10.2z" fill="#8a6419" />
      <Path
        d="M11.2 8.6h9.6c.5 5.8-1.8 9.2-4.8 10.6v2.4h3.2v2H12.8v-2h3.2v-2.4c-3-1.4-5.3-4.8-4.8-10.6z"
        fill="#e0b44a"
      />
      <Path d="M13 10h6c.2 4.2-1.4 6.6-3 7.4-1.6-.8-3.2-3.2-3-7.4z" fill="#f3d27a" />
      <Path d="M11.2 9c-3 .6-4.6 3-4 6.2 1.4-.2 3-1.6 3.6-3.8z" fill="#c9922e" />
      <Path d="M20.8 9c3 .6 4.6 3 4 6.2-1.4-.2-3-1.6-3.6-3.8z" fill="#c9922e" />
      <Rect x="12.2" y="23.4" width="7.6" height="2.2" fill="#c9922e" />
      <Rect x="10.6" y="25.4" width="10.8" height="2.6" rx="0.6" fill="#8a6419" />
    </Svg>
  );
}

function BoneDustGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Ellipse cx="16" cy="25.2" rx="10.4" ry="3.2" fill="#5a4534" />
      <Path d="M6.8 22.4c1.6-5.2 4.8-8.6 9.2-8.6s7.6 3.4 9.2 8.6c-2.2 1.6-5.6 2.4-9.2 2.4s-7-.8-9.2-2.4z" fill="#c9b59a" />
      <Path d="M9.2 20.6c1.2-3.6 3.4-5.8 6.8-5.8s5.6 2.2 6.8 5.8c-1.6 1-4 1.6-6.8 1.6s-5.2-.6-6.8-1.6z" fill="#e8dcc8" />
      <Path d="M12.2 8.6l1.6 6.4-2.2.8 2.8 2.2-3.2 4.6" stroke="#8a7348" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <Ellipse cx="13.4" cy="8.2" rx="2.1" ry="1.6" fill="#f3e6d0" />
      <Ellipse cx="20.8" cy="18.4" rx="1.5" ry="1.1" fill="#f3e6d0" />
      <Ellipse cx="11.2" cy="21.2" rx="1.2" ry="0.9" fill="#8a7348" opacity="0.7" />
    </Svg>
  );
}

function ScrollGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M7.4 8.2h17.2c1.2 0 2.2 1 2.2 2.2v13.2c0 1.2-1 2.2-2.2 2.2H7.4c-1.2 0-2.2-1-2.2-2.2V10.4c0-1.2 1-2.2 2.2-2.2z" fill="#c9b59a" />
      <Path d="M6.4 10h19.2v13.2c0 .6-.5 1.1-1.1 1.1H7.5c-.6 0-1.1-.5-1.1-1.1V10z" fill="#e8dcc8" />
      <Path d="M5.2 7.6h4.4v17.6H5.2c-1.1 0-2-.9-2-2V9.6c0-1.1.9-2 2-2z" fill="#8a6a40" />
      <Path d="M22.4 7.6h4.4c1.1 0 2 .9 2 2v13.6c0 1.1-.9 2-2 2h-4.4V7.6z" fill="#6b5340" />
      <Path d="M11.2 13.2h9.6M11.2 16.4h8.2M11.2 19.6h6.8" stroke="#5a4534" strokeWidth="1.15" strokeLinecap="round" />
      <Circle cx="22.6" cy="21.2" r="2.1" fill="#2a1840" />
      <Path d="M22.6 19.6l.5 1.1 1.2.1-.9.8.3 1.1-1.1-.6-1.1.6.3-1.1-.9-.8 1.2-.1z" fill="#e0b44a" />
    </Svg>
  );
}

function WitchcraftBagGlyph({ size = 24 }: GlyphProps) {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Path d="M12 6.4v6.4M20 6.4v6.4" stroke="#e0b44a" strokeWidth="2.1" strokeLinecap="round" />
      <Path d="M8.2 12.2h15.6l-1.2 14.2c0 1.4-1.2 2.4-2.6 2.4H12c-1.4 0-2.6-1-2.6-2.4L8.2 12.2z" fill="#3a1848" />
      <Path d="M9.6 13.4h12.8l-1 12.2c0 1-1 1.8-2.1 1.8h-6.6c-1.1 0-2.1-.8-2.1-1.8l-1-12.2z" fill="#6b2d7a" />
      <Path d="M8.2 12.2h15.6v5.2c-2.4 1-5.2 1.5-7.8 1.5s-5.4-.5-7.8-1.5V12.2z" fill="#4a2d6a" />
      <Circle cx="16" cy="21.6" r="3.1" fill="#2a1840" />
      <Path
        d="M16 19.2l.7 1.5 1.6.2-1.2 1.1.3 1.6L16 22.6l-1.4.8.3-1.6-1.2-1.1 1.6-.2z"
        fill="#e0b44a"
      />
      <Path d="M13.4 8.6h5.2l-.8 3.4h-3.6z" fill="#8a6419" />
    </Svg>
  );
}

function HeadGlyph({ kind, size = 24 }: { kind: 'gluttony' | 'wrath' | 'lust'; size?: number }) {
  if (kind === 'lust') {
    return (
      <Svg viewBox="0 0 32 32" width={size} height={size}>
        <Path
          d="M16 26.4c-1 0-1.8-.4-7-5.2C5.4 17.4 6 12.2 9.6 10.6c2.2-1 4.4 0 6.4 2.2 2-2.2 4.2-3.2 6.4-2.2 3.6 1.6 4.2 6.8.6 10.6-5.2 4.8-6 5.2-7 5.2z"
          fill="#1a1014"
        />
        <Path
          d="M16 24.6c-.8 0-1.5-.3-6-4.4C7 17.2 7.5 13.2 10.2 12c1.8-.8 3.6 0 5.2 1.8l.6.7.6-.7c1.6-1.8 3.4-2.6 5.2-1.8 2.7 1.2 3.2 5.2.2 8.2-4.5 4.1-5.2 4.4-6 4.4z"
          fill="#c43a5c"
        />
        <Path d="M11.2 13.2c1.2-1 2.6-.6 3.8.8" stroke="#f6b4c4" strokeWidth="1.1" fill="none" />
        <Circle cx="13.6" cy="16.6" r="1.15" fill="#1a1014" />
        <Circle cx="18.4" cy="16.6" r="1.15" fill="#1a1014" />
      </Svg>
    );
  }
  const body = kind === 'wrath' ? '#a32a22' : '#6b2d7a';
  const shine = kind === 'wrath' ? '#c43b30' : '#8a3d98';
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Ellipse cx="16" cy="18" rx="9.4" ry="8.2" fill="#1a1014" />
      <Ellipse cx="16" cy="17" rx="8.6" ry="7.4" fill={body} />
      <Path d="M9.2 15.2c1.4-3.6 3.6-5.6 6.8-5.6s5.4 2 6.8 5.6" fill={shine} />
      <Circle cx="12.8" cy="16.2" r="1.7" fill="#1a1014" />
      <Circle cx="19.2" cy="16.2" r="1.7" fill="#1a1014" />
      <Path d="M13 20.6h6s-.3 2.4-3 2.4-3-2.4-3-2.4z" fill="#1a1014" />
      <Path d="M11.2 8.4l1.6-3.2 1.4 1.2-1.2 2.8z" fill="#e0b44a" />
      <Path d="M20.8 8.4l-1.6-3.2-1.4 1.2 1.2 2.8z" fill="#e0b44a" />
    </Svg>
  );
}

export function ItemIcon({ id, size = 24 }: { id: ItemId; size?: number }) {
  if (id === 'gold-pouch') return <GoldPouchGlyph size={size} />;
  if (id === 'rusty-key') return <KeyGlyph size={size} />;
  if (id === 'hard-key') return <KeyGlyph body="#8a93a0" ring="#6a7380" size={size} />;
  if (id === 'campaign-key') return <KeyGlyph body="#e0b44a" ring="#d4a017" size={size} />;
  if (id === 'torch-charm') return <CharmGlyph size={size} />;
  if (id === 'gem') return <GemGlyph size={size} />;
  if (id === 'gluttony-head') return <HeadGlyph kind="gluttony" size={size} />;
  if (id === 'wrath-head') return <HeadGlyph kind="wrath" size={size} />;
  if (id === 'lust-head') return <HeadGlyph kind="lust" size={size} />;
  if (id === 'bronze-medal') return <MedalGlyph metal="#b87333" shine="#d4a574" rim="#6b4530" size={size} />;
  if (id === 'silver-medal') return <MedalGlyph metal="#8a93a0" shine="#c5d0dc" rim="#3a4048" size={size} />;
  if (id === 'gold-medal') return <MedalGlyph metal="#e0b44a" shine="#f3d27a" rim="#8a6419" size={size} />;
  if (id === 'gold-cup') return <GoldCupGlyph size={size} />;
  if (id === 'bone-dust') return <BoneDustGlyph size={size} />;
  if (id === 'witchcraft-bag') return <WitchcraftBagGlyph size={size} />;
  if (id === 'scroll-of-portal') return <ScrollGlyph size={size} />;
  return <ShardGlyph size={size} />;
}
