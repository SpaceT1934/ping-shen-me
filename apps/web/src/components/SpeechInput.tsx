import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '../lib/ai-api';
import { pickRecordingType, recordingToWav } from '../lib/speech-audio';
import { LineIcon } from './Illustration';

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('录音读取失败，请重新录音'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

type Phase = 'idle' | 'permission' | 'recording' | 'transcribing';

export function SpeechInput({
  onText,
  disabled = false,
  maxChars = 2000,
  onBusyChange,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  maxChars?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const capabilities = useQuery({
    queryKey: ['ai-capabilities'],
    queryFn: aiApi.capabilities,
    staleTime: 60_000,
    retry: false,
  });
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const mounted = useRef(true);
  const cancelled = useRef(false);
  const locked = useRef(false);
  const startedAt = useRef(0);
  const pointer = useRef<{ at: number; y: number; wasRecording: boolean } | null>(null);
  const stopWhenReady = useRef(false);
  const busy = phase !== 'idle';
  const stopTracks = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  const closeContext = () => {
    void audioContext.current?.close().catch(() => {});
    audioContext.current = null;
  };
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stopTracks();
      closeContext();
    };
  }, []);
  useEffect(() => {
    if (phase !== 'recording') return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(Math.min(elapsed, 60));
      if (elapsed >= 60 && recorder.current?.state === 'recording') recorder.current.stop();
    };
    const interval = setInterval(tick, 250);
    // Returning from a backgrounded mobile tab also enforces the limit.
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase]);

  const transcribe = async (audio: Blob, context: AudioContext) => {
    setPhase('transcribing');
    try {
      if (!audio.size) throw new Error('没有录到声音，请重新录音');
      const wav = await recordingToWav(audio, context);
      if (!mounted.current || cancelled.current) return;
      const result = await aiApi.transcribe(await toBase64(wav), 'audio/wav');
      if (!mounted.current || cancelled.current) return;
      if (result.text.length > maxChars)
        throw new Error('转写文字超过输入上限，请缩短录音或先保存当前文字');
      onText(result.text);
    } catch (cause) {
      if (mounted.current && !cancelled.current)
        setError(cause instanceof Error ? cause.message : '转写失败，请重新录音或输入文字');
    } finally {
      closeContext();
      locked.current = false;
      if (mounted.current) setPhase('idle');
    }
  };
  const start = async () => {
    if (locked.current) return;
    locked.current = true;
    cancelled.current = false;
    setError('');
    setPhase('permission');
    try {
      if (!window.isSecureContext)
        throw new Error('当前是 HTTP 地址，请使用 HTTPS 地址后点击录音。');
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw new Error('当前浏览器不支持录音，请使用 Safari 或 Chrome 打开。');
      const mime = pickRecordingType((type) => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('当前浏览器不支持录音，请更换浏览器或输入文字。');
      // Create/resume in the click gesture, as required by mobile Safari.
      const context = new AudioContext();
      audioContext.current = context;
      await context.resume();
      if (!mounted.current) return;
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        closeContext();
        return;
      }
      stream.current = media;
      const device = new MediaRecorder(media, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.current = device;
      device.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      device.onerror = () => {
        if (recorder.current !== device) return;
        recorder.current = null;
        cancelled.current = true;
        stopTracks();
        closeContext();
        locked.current = false;
        if (mounted.current) {
          setPhase('idle');
          setError('录音中断，请重新录音或输入文字');
        }
      };
      device.onstop = () => {
        if (recorder.current !== device) return;
        recorder.current = null;
        stopTracks();
        if (!mounted.current || cancelled.current) {
          closeContext();
          locked.current = false;
          if (mounted.current) setPhase('idle');
          return;
        }
        void transcribe(new Blob(chunks, { type: device.mimeType || mime }), context);
      };
      device.start();
      if (stopWhenReady.current) {
        cancelled.current = true;
        device.stop();
        return;
      }
      startedAt.current = Date.now();
      setSeconds(0);
      setPhase('recording');
    } catch (cause) {
      stopTracks();
      closeContext();
      locked.current = false;
      if (mounted.current) {
        setPhase('idle');
        setError(
          cause instanceof Error && cause.name === 'NotAllowedError'
            ? '未获得麦克风权限，请在浏览器设置中允许麦克风后重试。'
            : cause instanceof Error && cause.name === 'NotFoundError'
              ? '没有找到麦克风，请检查设备后重试。'
              : cause instanceof Error
                ? cause.message
                : '录音失败，请重新尝试。',
        );
      }
    }
  };
  const recording = phase === 'recording';
  const enabled = capabilities.data?.asrEnabled === true;
  return (
    <div className="speech-input">
      <div className="ai-actions">
        <button
          type="button"
          className={`voice-button${recording ? ' is-recording' : ''}`}
          disabled={
            !enabled || disabled || phase === 'transcribing' || (!recording && maxChars <= 0)
          }
          onPointerDown={(event) => {
            if (
              event.button !== 0 ||
              disabled ||
              !enabled ||
              phase === 'permission' ||
              phase === 'transcribing'
            )
              return;
            pointer.current = { at: Date.now(), y: event.clientY, wasRecording: recording };
            stopWhenReady.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
            if (!recording) void start();
          }}
          onPointerMove={(event) => {
            if (pointer.current && pointer.current.y - event.clientY > 55) cancelled.current = true;
          }}
          onPointerUp={() => {
            const gesture = pointer.current;
            pointer.current = null;
            if (!gesture) return;
            if (gesture.wasRecording || Date.now() - gesture.at >= 350 || cancelled.current) {
              if (recorder.current?.state === 'recording') recorder.current.stop();
              else stopWhenReady.current = true;
            }
          }}
          onPointerCancel={() => {
            pointer.current = null;
            cancelled.current = true;
            stopWhenReady.current = true;
            if (recorder.current?.state === 'recording') recorder.current.stop();
          }}
          onClick={(event) => {
            // Pointer gestures are handled above; keyboard/assistive activation still toggles recording.
            if (event.detail !== 0) return;
            stopWhenReady.current = false;
            if (!recording) void start();
            else if (recorder.current?.state === 'recording') recorder.current.stop();
          }}
        >
          <LineIcon name="mic" size={20} />
          {phase === 'permission'
            ? '请允许麦克风…'
            : phase === 'transcribing'
              ? '正在转成文字…'
              : recording
                ? `结束录音 · ${seconds}s`
                : '按住说话 / 点击录音'}
        </button>
        {recording && (
          <button
            type="button"
            className="voice-cancel"
            onClick={() => {
              cancelled.current = true;
              if (recorder.current?.state === 'recording') recorder.current.stop();
            }}
          >
            取消录音
          </button>
        )}
      </div>
      <p className="small-print" role="status" aria-live="polite">
        {error ||
          (recording
            ? '正在听你说，最长 60 秒；长按松开发送，上滑取消；点按录音可再次点击结束。'
            : phase === 'transcribing'
              ? '正在识别录音，文字确认后才会保存。'
              : capabilities.isPending
                ? '正在检查语音服务…'
                : enabled
                  ? !window.isSecureContext
                    ? '手机录音需要 HTTPS 地址，当前可以先输入文字。'
                    : '按住说话，松开转文字；也可以点按开始、再次点击结束。'
                  : '语音服务暂不可用，可以先输入文字。')}
      </p>
    </div>
  );
}
