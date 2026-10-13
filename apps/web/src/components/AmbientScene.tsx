import { useEffect, useState } from 'react';
import { PixelIcon } from './PixelIcon';

// 场景自身保持固定，只让局部叶簇和几片小叶子轻微运动。
export function AmbientScene({ indoor = false }: { indoor?: boolean }) {
  const [paused, setPaused] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return (
    <div
      className={`ambient-scene ${indoor ? 'indoor-breeze' : 'orchard-breeze'} ${paused ? 'motion-paused' : ''}`}
      aria-hidden="true"
    >
      <div className="ambient-canopy" />
      {!indoor && (
        <div className="drifting-leaves">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}

export function LivingMascot({ size }: { size: number }) {
  return (
    <span className="living-mascot" aria-hidden="true">
      <PixelIcon name="mascot" size={size} className="mascot-body" />
      <PixelIcon name="mascot" size={size} className="mascot-leaves" />
    </span>
  );
}
