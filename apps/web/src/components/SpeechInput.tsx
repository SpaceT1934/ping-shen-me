import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '../lib/ai-api';

const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/flac'];
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('音频读取失败，请重新选择'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}
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
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    onBusyChange?.(recording || pending);
  }, [recording, pending, onBusyChange]);
  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      if (timer.current) clearTimeout(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const transcribe = async (audio: Blob, mime: string) => {
    setError('');
    if (!audio.size || audio.size > 5 * 1024 * 1024 || !allowedTypes.includes(mime)) {
      setError('请选择 5 MB 以内的 WAV、MP3、WebM、Ogg 或 FLAC 音频');
      return;
    }
    setPending(true);
    try {
      const result = await aiApi.transcribe(await toBase64(audio), mime);
      if (!mounted.current) return;
      if (result.text.length > maxChars)
        throw new Error('转写文字超过输入上限，请缩短录音或先保存当前文字');
      onText(result.text);
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : '转写失败，可以输入文字');
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  const start = async () => {
    setPending(true);
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw new Error('浏览器不支持录音，可以上传音频或输入文字');
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime) throw new Error('浏览器录音格式暂不支持，可以上传音频');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
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
        release();
        setRecording(false);
        setError('录音中断，可以重试或输入文字');
      };
      device.onstop = () => {
        release();
        if (!mounted.current) return;
        setRecording(false);
        void transcribe(new Blob(chunks, { type: mime }), mime.split(';')[0]!);
      };
      device.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (device.state === 'recording') device.stop();
      }, 60_000);
    } catch (cause) {
      release();
      if (mounted.current)
        setError(
          cause instanceof Error && cause.name !== 'NotAllowedError'
            ? cause.message
            : '没有麦克风权限，可以上传音频或输入文字',
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  const enabled = capabilities.data?.asrEnabled === true;
  return (
    <div className="speech-input">
      <div className="ai-actions">
        <button
          type="button"
          className="outline-button"
          disabled={!enabled || disabled || pending}
          onClick={() => (recording ? recorder.current?.stop() : void start())}
        >
          {pending ? '正在转写…' : recording ? '结束录音并转写' : '语音输入'}
        </button>
        <label className="audio-upload">
          上传音频
          <input
            aria-label="上传音频"
            type="file"
            accept=".wav,.mp3,.webm,.ogg,.flac"
            disabled={!enabled || disabled || pending || recording}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              const extension = file.name.split('.').pop()?.toLowerCase();
              const mime =
                (
                  {
                    wav: 'audio/wav',
                    mp3: 'audio/mpeg',
                    webm: 'audio/webm',
                    ogg: 'audio/ogg',
                    flac: 'audio/flac',
                  } as Record<string, string>
                )[extension ?? ''] ?? '';
              void transcribe(file, mime);
            }}
          />
        </label>
      </div>
      <p className="small-print" role="status">
        {error ||
          (recording
            ? '正在录音，最多 60 秒；结束后先检查文字。'
            : enabled
              ? '转写后可修改文字；录音不会保存到项目中。'
              : '语音暂未启用，可以先输入文字。')}
      </p>
    </div>
  );
}
