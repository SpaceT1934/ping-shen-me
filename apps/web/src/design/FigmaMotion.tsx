import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode, CSSProperties } from 'react';
import { welcomeMotion } from './welcome-motion';
import { usePreferences } from '../lib/preferences';
import { motionProfile } from './motion-profiles';

export function FigmaMotion({
  node = '',
  children,
  className,
  style,
  progress,
}: {
  node?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  progress?: number;
}) {
  const reduced = useReducedMotion();
  const prefs = usePreferences();
  const enabled = !reduced && prefs.motion;
  const profile = welcomeMotion[node] || motionProfile(node, progress);
  return (
    <motion.div
      data-node-id={node}
      className={className}
      style={style}
      {...(enabled
        ? profile
        : { initial: false, animate: finalState(profile), transition: { duration: 0 } })}
    >
      {children}
    </motion.div>
  );
}

function finalState(profile?: (typeof welcomeMotion)[string]) {
  const target = profile?.animate;
  return target && typeof target === 'object' && !Array.isArray(target)
    ? Object.fromEntries(
        Object.entries(target).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.at(-1) : value,
        ]),
      )
    : {};
}
