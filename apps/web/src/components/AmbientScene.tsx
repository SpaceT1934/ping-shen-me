import { useEffect, useState } from 'react';
import { Illustration, type MascotMood } from './Illustration';
export function AmbientScene({ indoor = false }: { indoor?: boolean }) {
  const [paused, setPaused] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return (
    <div
      className={`journal-ambient ${indoor ? 'paper-ambient' : 'garden-ambient'} ${paused ? 'motion-paused' : ''}`}
      aria-hidden="true"
    ></div>
  );
}
export function LivingMascot({ size, mood = 'welcome' }: { size: number; mood?: MascotMood }) {
  return (
    <span className={`journal-mascot mascot-${mood}`} aria-hidden="true">
      <Illustration name={`mascot-${mood}`} size={size} />
    </span>
  );
}
