import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Radio, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Bot, 
  AlertCircle, 
  PhoneCall, 
  PhoneOff, 
  MessageSquare, 
  Send, 
  Settings, 
  RotateCcw,
  Headphones,
  CheckCircle2,
  Waves
} from 'lucide-react';

interface VoiceLiveViewProps {
  language: 'kh' | 'en';
}

interface TranscriptItem {
  id: string;
  sender: 'user' | 'model';
  text?: string;
  timestamp: string;
}

export const VoiceLiveView: React.FC<VoiceLiveViewProps> = ({ language }) => {
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir'>('Zephyr');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([
    {
      id: 'init_note',
      sender: 'model',
      text: language === 'kh'
        ? 'សួស្តី! ខ្ញុំជាជំនួយការសម្លេងផ្ទាល់ Gemini 3.8 Live API។ ចុច "ចាប់ផ្តើមការហៅទូរស័ព្ទ (Start Voice Call)" ដើម្បីសន្ទនាផ្ទាល់ជាសម្លេងតាមរយៈ Live API។'
        : 'Welcome! I am your Gemini 3.8 Live Voice Concierge. Click "Start Voice Call" to start real-time conversation via Live API.',
      timestamp: 'Ready',
    },
  ]);
  const [textInput, setTextInput] = useState('');

  // Audio Contexts & WebSockets refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      const isActive = connectionStatus === 'connected';
      const amp = isSpeaking ? 32 : isUserTalking ? 24 : isActive ? 8 : 2;

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.lineWidth = 2.5 - i * 0.5;
        const colorAlpha = isActive ? (isSpeaking ? 'rgba(59, 130, 246, ' : 'rgba(16, 185, 129, ') : 'rgba(148, 163, 184, ';
        ctx.strokeStyle = `${colorAlpha}${0.8 - i * 0.2})`;

        for (let x = 0; x < width; x += 3) {
          const freq = 0.02 + i * 0.005;
          const y = centerY + Math.sin(x * freq + phase + i * 1.5) * amp * Math.sin((x / width) * Math.PI);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      phase += 0.06;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [connectionStatus, isSpeaking, isUserTalking]);

  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  const pcmToBase64 = (channelData: Float32Array): string => {
    const pcm16 = new Int16Array(channelData.length);
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / channelData.length);
    setIsUserTalking(rms > 0.04);

    let binary = '';
    const bytes = new Uint8Array(pcm16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const playAudioChunk = (audioCtx: AudioContext, base64Data: string) => {
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      if (nextAudioStartTimeRef.current < currentTime) {
        nextAudioStartTimeRef.current = currentTime;
      }
      source.start(nextAudioStartTimeRef.current);
      nextAudioStartTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setIsSpeaking(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Audio chunk decoding error:', err);
    }
  };

  const handleInterrupt = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextAudioStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setIsSpeaking(false);
  };

  const connectSession = async () => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      const outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputAudioCtx;
      outputAudioCtxRef.current = outputAudioCtx;
      nextAudioStartTimeRef.current = outputAudioCtx.currentTime;

      ws.onopen = async () => {
        console.log('[Live View] WebSocket opened');
        setConnectionStatus('connected');

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          const source = inputAudioCtx.createMediaStreamSource(stream);
          const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current = processor;
          source.connect(processor);
          processor.connect(inputAudioCtx.destination);

          processor.onaudioprocess = (e) => {
            if (isMicMuted || ws.readyState !== WebSocket.OPEN) return;
            const inputChannel = e.inputBuffer.getChannelData(0);
            const base64Audio = pcmToBase64(inputChannel);
            ws.send(
              JSON.stringify({
                type: 'audio',
                audio: base64Audio,
              })
            );
          };
        } catch (micErr: any) {
          console.warn('[Live View] Microphone access denied or not found:', micErr);
          setErrorMessage(
            language === 'kh'
              ? 'មិនអាចប្រើប្រាស់ Microphone បានទេ។ អ្នកនៅតែអាចវាយសាកល្បងសារជាអក្សរដើម្បីស្តាប់ការឆ្លើយតប Live Voice បាន!'
              : 'Microphone permission was not granted. You can still type prompts to listen to Live voice responses!'
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'audio' && msg.audio) {
            if (outputAudioCtxRef.current) {
              playAudioChunk(outputAudioCtxRef.current, msg.audio);
            }
          }
          if (msg.type === 'text' && msg.text) {
            setTranscripts((prev) => [
              ...prev,
              {
                id: `txt_${Date.now()}_${Math.random()}`,
                sender: 'model',
                text: msg.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
          if (msg.type === 'interrupted') {
            handleInterrupt();
          }
          if (msg.type === 'error') {
            setErrorMessage(msg.error);
            setConnectionStatus('error');
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Live View] WebSocket error:', err);
        setErrorMessage('Failed to connect to Live API server WebSocket');
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        console.log('[Live View] WebSocket closed');
        setConnectionStatus('disconnected');
        handleInterrupt();
      };
    } catch (err: any) {
      console.error('[Live View] Connect error:', err);
      setErrorMessage(err.message || 'Error connecting to Live API');
      setConnectionStatus('error');
    }
  };

  const disconnectSession = () => {
    handleInterrupt();
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setIsSpeaking(false);
    setIsUserTalking(false);
  };

  const handleSendTextMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'text',
        text: textInput,
      })
    );
    setTranscripts((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        sender: 'user',
        text: textInput,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setTextInput('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Radio className={`w-5 h-5 ${connectionStatus === 'connected' ? 'animate-pulse text-emerald-300' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                {language === 'kh' ? 'សន្ទនាសម្លេងផ្ទាល់ (Gemini 3.8 Live API)' : 'Real-time Voice (Gemini 3.8 Live)'}
              </h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {connectionStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {language === 'kh'
                ? 'សន្ទនាជាសម្លេងខ្មែរ និងអង់គ្លេសល្បឿនលឿនកម្រិតខ្ពស់ដោយ gemini-3.8-live'
                : 'Bidirectional low-latency voice interaction powered by gemini-3.8-live'}
            </p>
          </div>
        </div>

        {/* Voice Selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <Headphones className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">{language === 'kh' ? 'សម្លេង:' : 'Voice:'}</span>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value as any)}
              disabled={connectionStatus === 'connected'}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="Zephyr" className="bg-slate-800">Zephyr (Default)</option>
              <option value="Puck" className="bg-slate-800">Puck (Friendly)</option>
              <option value="Charon" className="bg-slate-800">Charon (Deep)</option>
              <option value="Kore" className="bg-slate-800">Kore (Calm)</option>
              <option value="Fenrir" className="bg-slate-800">Fenrir (Warm)</option>
            </select>
          </div>

          {connectionStatus === 'connected' ? (
            <button
              onClick={disconnectSession}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{language === 'kh' ? 'បញ្ចប់ការសន្ទនា' : 'End Call'}</span>
            </button>
          ) : (
            <button
              onClick={connectSession}
              disabled={connectionStatus === 'connecting'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-md shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>
                {connectionStatus === 'connecting'
                  ? (language === 'kh' ? 'កំពុងភ្ជាប់...' : 'Connecting...')
                  : (language === 'kh' ? 'ចាប់ផ្តើមការហៅទូរស័ព្ទ' : 'Start Voice Call')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="bg-amber-950/60 border-b border-amber-800/60 px-6 py-2.5 flex items-center gap-2 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Visualizer & Studio Stage */}
      <div className="p-6 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 shrink-0">
        <div className="relative w-full max-w-lg flex flex-col items-center">
          {/* Pulsing Avatar */}
          <div className="relative mb-4">
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                isSpeaking
                  ? 'bg-blue-600/30 ring-8 ring-blue-500/20 scale-105 shadow-2xl shadow-blue-500/50'
                  : isUserTalking
                  ? 'bg-emerald-600/30 ring-8 ring-emerald-500/20 scale-105 shadow-2xl shadow-emerald-500/50'
                  : connectionStatus === 'connected'
                  ? 'bg-slate-800 ring-4 ring-slate-700'
                  : 'bg-slate-800/50 ring-2 ring-slate-800'
              }`}
            >
              <Bot
                className={`w-12 h-12 transition-colors ${
                  isSpeaking
                    ? 'text-blue-400 animate-pulse'
                    : isUserTalking
                    ? 'text-emerald-400 animate-pulse'
                    : 'text-slate-400'
                }`}
              />
            </div>

            {/* Status badge */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300 shadow-md">
              {isSpeaking
                ? (language === 'kh' ? 'AI កំពុងនិយាយ...' : 'Speaking...')
                : isUserTalking
                ? (language === 'kh' ? 'អ្នកកំពុងនិយាយ...' : 'Listening...')
                : connectionStatus === 'connected'
                ? (language === 'kh' ? 'រួចរាល់' : 'Ready')
                : (language === 'kh' ? 'ទំនេរ' : 'Idle')}
            </div>
          </div>

          {/* Sound wave Canvas */}
          <canvas
            ref={canvasRef}
            width={480}
            height={70}
            className="w-full max-w-md h-16 rounded-xl bg-slate-950/40 border border-slate-800/80 mb-4"
          />

          {/* Controls Bar */}
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 p-2 rounded-2xl shadow-xl">
              <button
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`p-3 rounded-xl transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer ${
                  isMicMuted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>
                  {isMicMuted
                    ? (language === 'kh' ? 'បិទ Mic' : 'Mic Muted')
                    : (language === 'kh' ? 'Mic បើកធម្មតា' : 'Mic Active')}
                </span>
              </button>

              <button
                onClick={handleInterrupt}
                disabled={!isSpeaking}
                className="p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-xl transition-all flex items-center gap-1.5 text-xs cursor-pointer"
                title="កាត់ចង្វាក់សម្លេង"
              >
                <VolumeX className="w-4 h-4" />
                <span>{language === 'kh' ? 'កាត់សម្លេង' : 'Interrupt'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Transcripts and Conversation Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3" ref={transcriptScrollRef}>
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="text-center mb-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold bg-slate-800/60 px-3 py-1 rounded-full border border-slate-800">
              {language === 'kh' ? 'កំណត់ត្រាសន្ទនាផ្ទាល់ (Live Audio Transcripts)' : 'Live Voice Transcripts Log'}
            </span>
          </div>

          {transcripts.map((t) => {
            const isUser = t.sender === 'user';
            return (
              <div
                key={t.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Waves className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-xs'
                  }`}
                >
                  <p>{t.text}</p>
                  <span className="block text-[10px] text-slate-400 mt-1 text-right">
                    {t.timestamp}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fallback / Test Prompt Input bar */}
      <div className="bg-slate-950 border-t border-slate-800 p-4 shrink-0">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSendTextMessage} className="flex items-center gap-2">
            <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2 focus-within:border-blue-500">
              <MessageSquare className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={connectionStatus !== 'connected'}
                placeholder={
                  connectionStatus === 'connected'
                    ? (language === 'kh'
                        ? 'វាយសាកល្បងសួរទៅកាន់ Gemini 3.8 Live...'
                        : 'Type message to test Live voice response...')
                    : (language === 'kh'
                        ? 'សូមចុច "ចាប់ផ្តើមការហៅទូរស័ព្ទ" ខាងលើសិន'
                        : 'Click "Start Voice Call" above first')
                }
                className="w-full bg-transparent border-0 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={connectionStatus !== 'connected' || !textInput.trim()}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{language === 'kh' ? 'ផ្ញើ' : 'Send'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
