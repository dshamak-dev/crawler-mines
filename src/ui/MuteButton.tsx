import { SpeakerIcon } from './icons';

export default function MuteButton({
  muted,
  onToggle,
  variant = 'icon',
}: {
  muted: boolean;
  onToggle: () => void;
  variant?: 'icon' | 'row';
}) {
  const label = muted ? 'Sound off' : 'Sound on';
  if (variant === 'row') {
    return (
      <button
        type="button"
        className={`stone-btn sound-row${muted ? ' is-muted' : ''}`}
        onClick={onToggle}
        aria-pressed={!muted}
        aria-label={label}
      >
        <span className="player-row-main">
          <SpeakerIcon muted={muted} />
          {label}
        </span>
        <span>{muted ? 'Muted' : 'Playing'}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="ghost mute-btn"
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={label}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
