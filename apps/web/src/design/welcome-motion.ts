import type { MotionProps } from 'motion/react';
/** Exact snippets from Figma MCP, node 30:917. */
export const welcomeMotion: Record<string, MotionProps> = {
  '30:919': {
    initial: { opacity: 0, scaleX: 1, scaleY: 1, y: 26 },
    animate: {
      opacity: [0, 0, 1, 1],
      scaleX: [1, 1, 1.04, 1, 1],
      scaleY: [1, 1, 1.04, 1, 1],
      y: [26, 26, 0, 0],
    },
    transition: {
      opacity: {
        duration: 3.44,
        times: [0, 0.2616, 0.3605, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
      scaleX: {
        duration: 3.44,
        times: [0, 0.3605, 0.6221, 0.8837, 1],
        ease: ['linear', 'easeInOut', 'easeInOut', 'linear'],
        repeat: Infinity,
      },
      scaleY: {
        duration: 3.44,
        times: [0, 0.3605, 0.6221, 0.8837, 1],
        ease: ['linear', 'easeInOut', 'easeInOut', 'linear'],
        repeat: Infinity,
      },
      y: {
        duration: 3.44,
        times: [0, 0.2616, 0.3605, 1],
        ease: [
          'linear',
          (t) => 1 - Math.exp(-t * 7.591) * (Math.cos(t * 7.7443) + 0.9802 * Math.sin(t * 7.7443)),
          'linear',
        ],
        repeat: Infinity,
      },
    },
  },
  '30:922': {
    initial: { rotate: 0, scaleX: 0, scaleY: 0, x: 0, y: 0 },
    animate: {
      rotate: [0, 0, -3, 3, -2, 0, 0],
      scaleX: [0, 0, 1, 1],
      scaleY: [0, 0, 1, 1],
      x: [0, 0, -3.7, -3.7],
      y: [0, 0, -72.6, -72.6],
    },
    transition: {
      rotate: {
        duration: 3.44,
        times: [0, 0.3605, 0.5058, 0.6512, 0.7965, 0.9419, 1],
        ease: ['linear', 'easeInOut', 'easeInOut', 'easeInOut', 'easeInOut', 'linear'],
        repeat: Infinity,
      },
      scaleX: {
        duration: 3.44,
        times: [0, 0.0203, 0.2326, 1],
        ease: [
          'linear',
          (t) => 1 - Math.exp(-t * 7.5137) * (Math.cos(t * 9.0208) + 0.8329 * Math.sin(t * 9.0208)),
          'linear',
        ],
        repeat: Infinity,
      },
      scaleY: {
        duration: 3.44,
        times: [0, 0.0203, 0.2326, 1],
        ease: [
          'linear',
          (t) => 1 - Math.exp(-t * 7.5137) * (Math.cos(t * 9.0208) + 0.8329 * Math.sin(t * 9.0208)),
          'linear',
        ],
        repeat: Infinity,
      },
      x: {
        duration: 3.44,
        times: [0, 0.0116, 0.2326, 1],
        ease: [
          'linear',
          (t) => 1 - Math.exp(-t * 7.5137) * (Math.cos(t * 9.0208) + 0.8329 * Math.sin(t * 9.0208)),
          'linear',
        ],
        repeat: Infinity,
      },
      y: {
        duration: 3.44,
        times: [0, 0.0116, 0.2326, 1],
        ease: [
          'linear',
          (t) => 1 - Math.exp(-t * 7.5137) * (Math.cos(t * 9.0208) + 0.8329 * Math.sin(t * 9.0208)),
          'linear',
        ],
        repeat: Infinity,
      },
    },
  },
  '30:923': {
    initial: { opacity: 0 },
    animate: { opacity: [0, 0, 1, 1] },
    transition: {
      opacity: {
        duration: 3.44,
        times: [0, 0.0116, 0.157, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
    },
  },
  '30:924': {
    initial: { y: 0 },
    animate: { y: [0, 0, -20, -20] },
    transition: {
      y: {
        duration: 3.44,
        times: [0, 0.1221, 0.2267, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
    },
  },
  '30:925': {
    initial: { y: 0 },
    animate: { y: [0, 0, -20, -20] },
    transition: {
      y: {
        duration: 3.44,
        times: [0, 0.1395, 0.2442, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
    },
  },
  '30:926': {
    initial: { y: 0 },
    animate: { y: [0, 0, -20, -20] },
    transition: {
      y: {
        duration: 3.44,
        times: [0, 0.157, 0.2616, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
    },
  },
  '30:927': {
    initial: { y: 0 },
    animate: { y: [0, 0, -20, -20] },
    transition: {
      y: {
        duration: 3.44,
        times: [0, 0.1744, 0.2791, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
    },
  },
  '30:928': {
    initial: { y: 0 },
    animate: { y: [0, 0, -20, -20] },
    transition: {
      y: {
        duration: 3.44,
        times: [0, 0.1919, 0.2965, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
    },
  },
  '30:941': {
    initial: { opacity: 0 },
    animate: { opacity: [0, 0, 1, 1] },
    transition: {
      opacity: {
        duration: 3.44,
        times: [0, 0.2209, 0.3256, 1],
        ease: ['linear', 'easeOut', 'linear'],
        repeat: Infinity,
      },
    },
  },
  '30:942': {},
  '30:943': {},
};
