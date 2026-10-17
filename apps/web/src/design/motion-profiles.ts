import type { MotionProps, Transition, Easing } from 'motion/react';
import bindings from './motion-data.json';
type Frame = {
  at: number;
  value: { floatValue?: number; vectorValue?: { x: number; y: number } };
  ease: {
    easingType: string;
    easingValue?: {
      bezierEasing?: { p1x: number; p1y: number; p2x: number; p2y: number };
      springEasing?: { stiffness: number; damping: number; mass: number };
    };
  };
};
type Binding = {
  name: string;
  root: string;
  duration: number;
  tracks: { field: string; frames: Frame[] }[];
};
const data = bindings as unknown as Record<string, Binding>;
function easing(frame: Frame, seconds: number): Easing {
  const { easingType: type, easingValue: value } = frame.ease;
  if (type === 'OUT_CUBIC') return [0.215, 0.61, 0.355, 1];
  if (type === 'INOUT_CUBIC') return [0.645, 0.045, 0.355, 1];
  if (value?.bezierEasing) {
    const b = value.bezierEasing;
    return [b.p1x, b.p1y, b.p2x, b.p2y];
  }
  if (value?.springEasing) {
    const { stiffness: k, damping: c, mass: m } = value.springEasing;
    const w = Math.sqrt(k / m),
      z = c / (2 * Math.sqrt(k * m));
    return (t) => {
      const time = t * seconds;
      if (t >= 1) return 1;
      if (z >= 1) return 1 - (1 + w * time) * Math.exp(-w * time);
      const wd = w * Math.sqrt(1 - z * z);
      return (
        1 - Math.exp(-z * w * time) * (Math.cos(wd * time) + ((z * w) / wd) * Math.sin(wd * time))
      );
    };
  }
  return 'linear';
}
export function motionNode(root: string, name: string, index = 0) {
  return Object.entries(data).filter(([, value]) => value.root === root && value.name === name)[
    index
  ]?.[0];
}
export function motionProfile(node: string, progress?: number): MotionProps | undefined {
  const binding = data[node];
  if (!binding) return;
  const initial: Record<string, number | string> = {},
    animate: Record<string, (number | string)[]> = {},
    transition: Record<string, Transition> = {};
  for (const track of binding.tracks) {
    const properties = (
      {
        OPACITY: ['opacity'],
        WIDTH: ['width'],
        MOTION_TRANSLATION_Y: ['y'],
        MOTION_ROTATION: ['rotate'],
        MOTION_TRANSLATION_XY: ['x', 'y'],
        MOTION_SCALE_XY: ['scaleX', 'scaleY'],
        MOTION_SCALE_X: ['scaleX'],
        MOTION_SCALE_Y: ['scaleY'],
      } as Record<string, string[]>
    )[track.field];
    if (!properties) continue;
    const frames = [...track.frames];
    if (frames[0]!.at > 0) frames.unshift({ ...frames[0]!, at: 0 });
    if (frames.at(-1)!.at < binding.duration)
      frames.push({ ...frames.at(-1)!, at: binding.duration });
    for (const [index, property] of properties.entries()) {
      let values: (number | string)[] = frames.map(
        (frame) =>
          frame.value.floatValue ??
          (index === 0 ? frame.value.vectorValue?.x : frame.value.vectorValue?.y) ??
          0,
      );
      if (property === 'width' && progress !== undefined) {
        const max = Number(values.at(-1)) || 1;
        values = values.map((value) => `${(Number(value) / max) * progress}%`);
      }
      initial[property] = values[0]!;
      animate[property] = values;
      transition[property] = {
        duration: binding.duration,
        times: frames.map((frame) => frame.at / binding.duration),
        ease: frames
          .slice(0, -1)
          .map((frame, index) => easing(frame, frames[index + 1]!.at - frame.at)),
        repeat: Infinity,
      };
    }
  }
  return { initial, animate, transition } as MotionProps;
}
