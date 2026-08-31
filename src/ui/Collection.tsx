import { useState } from 'react';
import {
  inventoryTotal,
  isTicketKey,
  sealedRowLabel,
  sealedRunRows,
  stackedEntries,
  type CollectionState,
  type Game,
  type Inventory,
} from '../engine';
import { BagIcon, ChestIcon, GoldIcon, ItemIcon } from './icons';

const EMPTY_COPY = 'Chests stay sealed until you clear the floor. Bombs can still smash them.';

export default function Collection({
  meta,
  runLoot,
  game,
  stashGold = 0,
  sealed = false,
  onBack,
}: {
  meta: CollectionState;
  runLoot: Inventory;
  game?: Game;
  stashGold?: number;
  sealed?: boolean;
  onBack: () => void;
}) {
  if (sealed && game) {
    const rows = sealedRunRows(game, runLoot, stashGold);
    const total = rows.reduce((sum, row) => sum + row.count, 0);

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
          <span className="floor-pill">{total} sealed</span>
        </header>

        {rows.length === 0 ? (
          <div className="collection-empty">
            <p>{EMPTY_COPY}</p>
          </div>
        ) : (
          <ul className="loot-list">
            {rows.map((row) => {
              const { title, subtitle } = sealedRowLabel(row);
              const key = `${row.kind}:${row.tier ?? 'gold'}:${row.wrecked ? 'wreck' : 'ok'}`;
              return (
                <li key={key} className="loot-card">
                  <span className="loot-ico">
                    {row.kind === 'gold-bag' ? (
                      <ItemIcon id="gold-pouch" />
                    ) : row.wrecked ? (
                      <ChestIcon wrecked tier={row.tier ?? 'wooden'} />
                    ) : (
                      <ChestIcon tier={row.tier ?? 'wooden'} />
                    )}
                  </span>
                  <span className="loot-copy">
                    <strong>{title}</strong>
                    <em>{subtitle}</em>
                  </span>
                  <span className="loot-count">×{row.count}</span>
                </li>
              );
            })}
          </ul>
        )}

        <button type="button" className="stone-btn collection-back" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  return <TitleCollection meta={meta} runLoot={runLoot} onBack={onBack} />;
}

function TitleCollection({
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
            <li key={item.id} className={`loot-card${isTicketKey(item.id) ? ' is-ticket' : ''}`}>
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
