import type { CSSProperties } from 'react';

// One generated material family, reused everywhere. Small utility controls use plain text.
const assets: Record<string, string> = {
  grid: 'workspace', history: 'history', people: 'community', layers: 'projects',
  sun: 'everyday', shield: 'approval', calendar: 'calendar', message: 'message',
  orbit: 'orbit', spark: 'orbit',
};
const symbols: Record<string, string> = { arrow: '→', check: '✓', close: '×' };

export function Icon({ name, size = 24, style }: { name: string; size?: number; style?: CSSProperties }) {
  if (symbols[name]) return <span className="utility-symbol" aria-hidden="true" style={style}>{symbols[name]}</span>;
  const asset = assets[name] || 'workspace';
  return <img
    className={`object-icon object-${asset}`}
    src={`/assets/orbit-3d/${asset}.png`}
    width={Math.max(size, 24)} height={Math.max(size, 24)}
    alt="" aria-hidden="true" draggable={false} decoding="async"
    style={{ '--requested-icon-size': `${Math.max(size, 24)}px`, ...style } as CSSProperties}
  />;
}

export function BrandMark() {
  return <img className="orbit-mark" src="/assets/orbit-3d/orbit.png" width={39} height={39} alt="" aria-hidden="true" draggable={false}/>;
}
