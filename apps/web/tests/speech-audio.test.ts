import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeMonoWav, pickRecordingType, recordingToWav } from '../src/lib/speech-audio';

afterEach(() => vi.unstubAllGlobals());

describe('mobile speech audio', () => {
  it('selects Safari MP4 when Opus formats are unavailable', () => {
    expect(pickRecordingType((type) => type === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecordingType(() => false)).toBeUndefined();
  });
  it('prefers Opus on browsers that support it', () => {
    expect(pickRecordingType(() => true)).toBe('audio/webm;codecs=opus');
  });
  it('encodes valid mono PCM WAV with correct lengths and clipped samples', () => {
    const audio = encodeMonoWav(new Float32Array([-2, -0.5, 0, 0.5, 2]), 16000);
    const view = new DataView(audio);
    const text = (start: number, length: number) =>
      new TextDecoder().decode(new Uint8Array(audio, start, length));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(text(36, 4)).toBe('data');
    expect(view.getUint32(4, true)).toBe(audio.byteLength - 8);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(Array.from({ length: 5 }, (_, i) => view.getInt16(44 + i * 2, true))).toEqual([
      -32768, -16384, 0, 16384, 32767,
    ]);
  });
  it('normalizes browser recordings to a single 16 kHz channel', async () => {
    const connect = vi.fn();
    const start = vi.fn();
    const constructor = vi.fn();
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        destination = {};
        constructor(...args: unknown[]) {
          constructor(...args);
        }
        createBufferSource() {
          return { buffer: null, connect, start };
        }
        async startRendering() {
          return { getChannelData: () => new Float32Array(16000) };
        }
      },
    );
    const context = { decodeAudioData: vi.fn().mockResolvedValue({ length: 48000, duration: 1 }) };
    const result = await recordingToWav(
      new Blob(['recording']),
      context as unknown as AudioContext,
    );
    expect(constructor).toHaveBeenCalledWith(1, 16000, 16000);
    expect(connect).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    expect(result.type).toBe('audio/wav');
    expect(result.size).toBe(32044);
  });
  it('rejects recordings exceeding the duration limit before conversion or upload', async () => {
    const context = {
      decodeAudioData: vi.fn().mockResolvedValue({ length: 3200000, duration: 70 }),
    };
    await expect(
      recordingToWav(new Blob(['recording']), context as unknown as AudioContext),
    ).rejects.toThrow('录音过长');
  });
});
