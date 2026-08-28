import { useState } from 'react';
import {
  inventoryTotal,
  stackedEntries,
  type CollectionState,
  type Inventory,
} from '../engine';
import { BagIcon, GoldIcon, ItemIcon } from './icons';

const EMPTY_COPY = 'Chests stay sealed until you clear the floor. Bombs can still smash them.';

export default function Collection({
  meta,
  runLoot,
  onBack,
}: {
  meta: CollectionState;
  runLoot: Inventory;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'all' | 'run'>('all');
  const inv = tab === 'all' ? meta.items : runLoot;
  const rows = stackedEntries(inv);
  const total = inventoryTotal(inv);
  const runCount = inventoryTotal(runLoot);

  return (
    <div className="shell collection-shell">
      <header className="collection-head">
        <button type="button" className="ghost back-thumb" onClick={onBack} aria-label="Back">
          {'\u2039'}
        </button>
        <div className="collection-title">
          <BagIcon />
          <h1>Collection</h1>
        </div>
        <span className="floor-pill">{total} held</span>
      </header>

      <div className="wallet-strip" aria-label={`${meta.gold} coins in wallet`}>
        <GoldIcon />
        <span className="wallet-copy">
          <strong>{meta.gold}</strong>
          <em>wallet</em>
        </span>
      </div>

      <div className="filter-row" role="tablist" aria-label="Collection filter">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`filter-chip${tab === 'all' ? ' on' : ''}`}
          onClick={() => setTab('all')}
        >
          All salvage
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'run'}
          className={`filter-chip${tab === 'run' ? ' on' : ''}`}
          onClick={() => setTab('run')}
        >
          This run{runCount > 0 ? ` · ${runCount}` : ''}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="collection-empty">
          <p>{EMPTY_COPY}</p>
        </div>
      ) : (
        <ul className="loot-list">
          {rows.map(({ item, count }) => (
            <li key={item.id} className="loot-card">
              <span className="loot-ico">
                <ItemIcon id={item.id} />
              </span>
              <span className="loot-copy">
                <strong>{item.name}</strong>
                <em>{item.flavor}</em>
              </span>
              <span className="loot-count">×{count}</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="stone-btn collection-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
