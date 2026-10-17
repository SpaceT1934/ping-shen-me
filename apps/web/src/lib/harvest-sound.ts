/** Resume within the user's harvest gesture; only play after a successful save. */
export function prepareHarvestSound(enabled: boolean) {
  if (!enabled || typeof AudioContext === 'undefined') return () => {};
  const context = new AudioContext();
  void context.resume().catch(() => {});
  let closed = false;
  const dispose = () => {
    if (!closed) {
      closed = true;
      void context.close().catch(() => {});
    }
  };
  const timeout = setTimeout(dispose, 25_000);
  return (success = false) => {
    clearTimeout(timeout);
    if (!success || closed) {
      dispose();
      return;
    }
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const at = context.currentTime + index * 0.09;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.035, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.32);
    });
    setTimeout(dispose, 600);
  };
}
