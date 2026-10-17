import { useEffect, type RefObject } from 'react';
import {
  animate,
  type DOMKeyframesDefinition,
  type AnimationOptions,
  type AnimationPlaybackControlsWithThen,
} from 'motion';
import { useReducedMotion } from 'motion/react';
import { usePreferences } from '../lib/preferences';
import { motionNode, motionProfile } from './motion-profiles';

/** Figma node names → semantic live UI slots. Repeated data uses the corresponding sample's track. */
const scenes: Record<string, { root: string; slots: [string, string][] }> = {
  '/': { root: '31:3393', slots: [['进度/值', '.forest-progress-note .progress-track > span']] },
  '/seed': { root: '30:838', slots: [['区域/card', '.fig-category-grid button']] },
  '/seed/ai': {
    root: '30:946',
    slots: [
      ['区域/bubble', '.ai-chat-message .speech-bubble'],
      ['素材/mascot-calm', '.ai-chat-message > img'],
    ],
  },
  '/projects': {
    root: '30:1261',
    slots: [
      ['区域/card', '.project-card'],
      ['进度/值', '.project-card .progress-track > span'],
    ],
  },
  '/project': {
    root: '30:1185',
    slots: [
      ['素材/tree-large-full', '.detail-hero-tree'],
      ...['sprout', 'growing', 'strong', 'full'].map(
        (name, index) =>
          [
            `素材/stage-${name}`,
            `.tree-stage-gallery > div:nth-child(${index + 1}) .project-tree`,
          ] as [string, string],
      ),
      ['进度/值', '.target-goal .progress-track > span'],
    ],
  },
  '/records': {
    root: '30:1035',
    slots: [
      ['区域/bubble', '.record-bubble'],
      ['区域/card', '.record-panel'],
      ['素材/mascot-wink', '.record-mascot'],
    ],
  },
  '/records/confirm': {
    root: '31:2988',
    slots: [
      ['区域/mint', '.confirm-intro'],
      ['区域/selected', '.draft-card'],
    ],
  },
  '/seed/generated': {
    root: '30:993',
    slots: [
      ['区域/card', '.ai-candidate'],
      ['按钮/确认，种下我的树们→', '.ai-seed > .dark-button'],
    ],
  },
  '/growth': {
    root: '31:3046',
    slots: [
      ['区域/bubble', '.feedback-intro .speech-bubble'],
      ['区域/card', '.feedback-project'],
      ['素材/mascot-feedback', '.feedback-intro .journal-mascot'],
    ],
  },
  '/fruit': {
    root: '30:1085',
    slots: [
      ['区域/card', '.harvest-paper'],
      ['按钮/摘下这颗果子', '.harvest-paper .coral-button'],
    ],
  },
  '/goals': {
    root: '30:1359',
    slots: [
      ['区域/card', '.goal-checklist-card'],
      ['进度/值', '.goal-checklist-card .progress-track > span'],
    ],
  },
  '/reports': {
    root: '30:1465',
    slots: [
      ['区域/card', '.report-stats > div'],
      ...Array.from(
        { length: 7 },
        (_, index) =>
          [`图表/每日行动/${index}`, `.activity-bars > div:nth-child(${index + 1}) > span`] as [
            string,
            string,
          ],
      ),
    ],
  },
  '/timeline': {
    root: '30:1562',
    slots: [
      ['区域/card', '.fig-timeline-item .fig-card'],
      ['素材/fruit-red', '.fig-timeline-item > img'],
    ],
  },
  '/collection': {
    root: '30:1649',
    slots: [
      ['区域/card', '.fig-collection .fig-card'],
      ['素材/apple-stat', '.fig-collection .fig-card > img'],
    ],
  },
  '/share': {
    root: '30:1755',
    slots: [
      ['区域/card', '.fig-share-card'],
      ['素材/sun', '.share-decoration-sun'],
      ['素材/leaf-falling', '.share-decoration-leaf'],
    ],
  },
  '/settings': {
    root: '31:2096',
    slots: [
      ['区域/mint', '.fig-metrics > div:nth-child(1)'],
      ['区域/rose', '.fig-metrics > div:nth-child(even)'],
      ['区域/wood', '.fig-metrics > div:nth-child(3)'],
      ['进度/值', '.profile-project-row .progress-track > span'],
    ],
  },
  '/reminders': {
    root: '31:2284',
    slots: [
      ['区域/card', '.reminder-card'],
      ...['tree', 'fruit', 'calendar'].map(
        (name, index) =>
          [
            `素材/remind-${name}`,
            `.reminder-card:nth-child(${index + 1}) .fig-setting-row > img`,
          ] as [string, string],
      ),
    ],
  },
  '/quiz': {
    root: '31:3166',
    slots: [
      ['区域/bubble', '.fig-header .speech-bubble'],
      ['区域/selected', '.fig-quiz-choice:nth-of-type(1)'],
      ['区域/paper', '.fig-quiz-choice'],
    ],
  },
  '/reminders/preview': { root: '31:2243', slots: [['区域/paper', '.inactive-dialog']] },
  '/plan': {
    root: '31:3117',
    slots: [
      ['区域/card', '.task-plan-list .fig-card'],
      ['素材/mascot-cheer', '.fig-header-body > img'],
    ],
  },
};

export function useDesignMotion(ref: RefObject<HTMLElement | null>, pathname: string) {
  const prefs = usePreferences();
  const reduced = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (!root || !prefs.motion || reduced || pathname === '/welcome') return;
    const key = /\/projects\/[^/]+\/plan$/.test(pathname)
      ? '/plan'
      : /\/projects\/[^/]+$/.test(pathname)
        ? '/project'
        : pathname;
    const source = scenes[key];
    if (!source) return;
    let startedAt = performance.now();
    let sceneRoot = source.root;
    const controls = new Map<HTMLElement, AnimationPlaybackControlsWithThen>();
    const used = new Set<HTMLElement>();
    const attach = () => {
      controls.forEach((control, element) => {
        if (!root.contains(element)) {
          control.cancel();
          controls.delete(element);
          used.delete(element);
        }
      });
      const scene =
        key === '/records' && root.querySelector('.confirm-page')
          ? scenes['/records/confirm']!
          : key === '/seed/ai' && root.querySelector('.ai-candidate')
            ? scenes['/seed/generated']!
            : source;
      if (scene.root !== sceneRoot) {
        sceneRoot = scene.root;
        startedAt = performance.now();
      }
      for (const [name, selector] of scene.slots) {
        root.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
          if (used.has(element) || element.dataset.nodeId) return;
          const node = motionNode(scene.root, name, index) || motionNode(scene.root, name);
          if (!node) return;
          const profile = motionProfile(node);
          if (
            !profile?.animate ||
            typeof profile.animate !== 'object' ||
            Array.isArray(profile.animate)
          )
            return;
          const values = { ...profile.animate } as DOMKeyframesDefinition;
          const timing = {
            ...profile.transition,
            delay: -(performance.now() - startedAt) / 1000,
          } as AnimationOptions;
          // Design progress widths are normalized to the live data's existing width.
          if (Array.isArray(values.width)) {
            const width = Number(values.width.at(-1)) || 1;
            values.scaleX = values.width.map((value) => Number(value) / width);
            delete values.width;
            const fields = timing as Record<string, unknown>;
            fields.scaleX = fields.width;
            delete fields.width;
            element.style.transformOrigin = 'left center';
          }
          used.add(element);
          element.dataset.motionNode = node;
          controls.set(element, animate(element, values, timing));
        });
      }
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });
    const visibility = () =>
      controls.forEach((control) => (document.hidden ? control.pause() : control.play()));
    document.addEventListener('visibilitychange', visibility);
    const focus = () => controls.forEach((control) => control.pause());
    const blur = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null) && !document.hidden)
        controls.forEach((control) => control.play());
    };
    root.addEventListener('focusin', focus);
    root.addEventListener('focusout', blur);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('focusout', blur);
      controls.forEach((control) => control.cancel());
      used.forEach((element) => {
        element.style.transform = '';
        element.style.opacity = '';
        delete element.dataset.motionNode;
      });
    };
  }, [ref, pathname, prefs.motion, reduced]);
}
