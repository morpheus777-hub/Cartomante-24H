import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Mic,
  MicOff,
  PhoneCall,
  Radio,
  Send,
  Sparkles,
  Square,
  Trash2,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MAJOR_ARCANA } from '../data/tarotDeck';
import type { ChatMessage, Consultation, ConsultationTier, DrawnCardRecord, PublicUser } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function CartomancerSection() {
  const {
    user,
    cartomancers,
    consultations,
    onlineSessions,
    liveTables,
    setActiveModal,
    notifyToast,
    apiFetch,
    refreshBootstrap,
    sendWsMessage,
    subscribeWsEvent,
  } = useApp();

  const [filterMode, setFilterMode] = useState<'all' | 'live' | 'approved_full'>('all');
  const [bookingReader, setBookingReader] = useState<PublicUser | null>(null);
  const [tier, setTier] = useState<ConsultationTier>('one_question');
  const [question, setQuestion] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 1000 * 60 * 30);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [bookingBusy, setBookingBusy] = useState(false);

  // Real-time Consultation Chat & Voice Audio state
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [consultMessages, setConsultMessages] = useState<ChatMessage[]>([]);
  const [consultDraft, setConsultDraft] = useState('');
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordDurationRef = useRef(0);

  // Consultation 1:1 WebRTC Video Call state
  const [consultCallActive, setConsultCallActive] = useState(false);
  const [consultRemoteConnected, setConsultRemoteConnected] = useState(false);
  const consultLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const consultRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const consultLocalStreamRef = useRef<MediaStream | null>(null);
  const consultPcRef = useRef<RTCPeerConnection | null>(null);

  // Live Stream Room (Cartomancer-only broadcast + WebRTC viewers)
  const [activeLiveReader, setActiveLiveReader] = useState<PublicUser | null>(null);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [liveDraft, setLiveDraft] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [remoteLiveConnected, setRemoteLiveConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteLiveVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livePeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);

  const isCartomancerUser = user?.role === 'cartomancer';
  const myCartomancerConsultations = isCartomancerUser
    ? consultations.filter((c) => c.cartomancerId === user.id)
    : [];

  const filteredReaders = cartomancers.filter((c) => {
    if (filterMode === 'live') return Boolean(c.isLive);
    if (filterMode === 'approved_full') return c.fullReadingStatus === 'approved';
    return true;
  });

  const isBroadcasterOfActiveLive = Boolean(
    user &&
      user.role === 'cartomancer' &&
      activeLiveReader &&
      user.id === activeLiveReader.id
  );

  // Stop audio recording helper
  const stopAudioRecording = useCallback((send: boolean) => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (!send) {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
      };
    }
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    setRecordingAudio(false);
  }, []);

  const startAudioRecording = async () => {
    if (!activeConsultation) return;
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      notifyToast('Áudio não suportado', 'Seu navegador não permite gravação de voz.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordDurationRef.current = 0;
      setRecordingSeconds(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 1_500_000) {
          notifyToast('Áudio muito longo', 'Grave mensagens de até 60 segundos.', 'error');
          return;
        }
        setSendingAudio(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!dataUrl || !activeConsultation) return;
            const res = await apiFetch<{ message: ChatMessage }>(`/api/chat/consult:${activeConsultation.id}`, {
              method: 'POST',
              body: JSON.stringify({
                audioDataUrl: dataUrl,
                audioDurationSec: Math.max(1, recordDurationRef.current),
              }),
            });
            setConsultMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
          } catch (err) {
            notifyToast('Erro ao enviar áudio', err instanceof Error ? err.message : 'Tente novamente.', 'error');
          } finally {
            setSendingAudio(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingAudio(true);
      recordTimerRef.current = setInterval(() => {
        recordDurationRef.current += 1;
        setRecordingSeconds(recordDurationRef.current);
        if (recordDurationRef.current >= 60) {
          stopAudioRecording(true);
        }
      }, 1000);
    } catch {
      notifyToast('Microfone bloqueado', 'Permita o acesso ao microfone no navegador para enviar áudio.', 'error');
    }
  };

  // Cleanup Consultation Video Call
  const stopConsultVideoCall = useCallback(() => {
    if (activeConsultation) {
      sendWsMessage({ type: 'webrtc:leave', roomId: `consult:${activeConsultation.id}` });
    }
    if (consultLocalStreamRef.current) {
      consultLocalStreamRef.current.getTracks().forEach((t) => t.stop());
      consultLocalStreamRef.current = null;
    }
    if (consultPcRef.current) {
      consultPcRef.current.close();
      consultPcRef.current = null;
    }
    setConsultCallActive(false);
    setConsultRemoteConnected(false);
  }, [activeConsultation, sendWsMessage]);

  const startConsultVideoCall = async () => {
    if (!activeConsultation) return;
    if (consultCallActive) {
      stopConsultVideoCall();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      consultLocalStreamRef.current = stream;
      setConsultCallActive(true);
      setTimeout(() => {
        if (consultLocalVideoRef.current) {
          consultLocalVideoRef.current.srcObject = stream;
        }
      }, 40);

      const roomId = `consult:${activeConsultation.id}`;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      consultPcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (ev) => {
        setConsultRemoteConnected(true);
        if (consultRemoteVideoRef.current && ev.streams[0]) {
          consultRemoteVideoRef.current.srcObject = ev.streams[0];
        }
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWsMessage({ type: 'webrtc:ice', roomId, payload: ev.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWsMessage({ type: 'webrtc:offer', roomId, payload: offer });
    } catch {
      notifyToast('Câmera ou microfone bloqueado', 'Permita vídeo e microfone no navegador para a chamada.', 'error');
    }
  };

  // Live Broadcast Camera + Mic activation (Strictly Cartomancer Only)
  const activateLiveMedia = useCallback(async () => {
    if (!isBroadcasterOfActiveLive || !activeLiveReader) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setCameraActive(true);
      setMicMuted(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 40);

      await apiFetch('/api/cartomancer/live', {
        method: 'POST',
        body: JSON.stringify({
          isLive: true,
          liveTitle: activeLiveReader.liveTitle || 'Vídeo Chamada Ao Vivo com Cartas',
        }),
      });
      await refreshBootstrap();
      notifyToast('Live com Vídeo e Microfone Ativa', 'Sua transmissão ao vivo foi iniciada.', 'success');
    } catch {
      notifyToast(
        'Câmera ou Microfone indisponível',
        'Permita acesso à câmera e ao microfone no navegador para transmitir.',
        'error'
      );
    }
  }, [activeLiveReader, apiFetch, isBroadcasterOfActiveLive, notifyToast, refreshBootstrap]);

  const stopLiveBroadcast = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    for (const pc of livePeersRef.current.values()) {
      pc.close();
    }
    livePeersRef.current.clear();
    setCameraActive(false);

    if (isBroadcasterOfActiveLive) {
      try {
        await apiFetch('/api/cartomancer/live', {
          method: 'POST',
          body: JSON.stringify({ isLive: false }),
        });
        await refreshBootstrap();
      } catch {
        // Ignore error on cleanup
      }
    }
  }, [apiFetch, isBroadcasterOfActiveLive, refreshBootstrap]);

  const toggleMicMute = () => {
    if (!streamRef.current) return;
    const nextMuted = !micMuted;
    streamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMicMuted(nextMuted);
  };

  // WebSocket event listener for Chat + WebRTC signaling
  useEffect(() => {
    return subscribeWsEvent(async (event, data) => {
      if (event === 'chat:message') {
        const msg = data as ChatMessage;
        if (activeConsultation && msg.roomId === `consult:${activeConsultation.id}`) {
          setConsultMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
        if (activeLiveReader && msg.roomId === `live:${activeLiveReader.id}`) {
          setLiveMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
        return;
      }

      if (!event.startsWith('webrtc:') || !data || typeof data !== 'object') return;
      const sig = data as {
        roomId: string;
        fromUserId: string;
        fromUserName: string;
        payload?: unknown;
      };

      // Handle Live Room WebRTC signaling
      if (activeLiveReader && sig.roomId === `live:${activeLiveReader.id}`) {
        if (event === 'webrtc:join' && isBroadcasterOfActiveLive && streamRef.current) {
          const pc = new RTCPeerConnection(RTC_CONFIG);
          livePeersRef.current.set(sig.fromUserId, pc);
          streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current!));
          pc.onicecandidate = (ev) => {
            if (ev.candidate) {
              sendWsMessage({
                type: 'webrtc:ice',
                roomId: sig.roomId,
                targetUserId: sig.fromUserId,
                payload: ev.candidate,
              });
            }
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendWsMessage({
            type: 'webrtc:offer',
            roomId: sig.roomId,
            targetUserId: sig.fromUserId,
            payload: offer,
          });
        } else if (event === 'webrtc:offer' && !isBroadcasterOfActiveLive) {
          if (viewerPcRef.current) viewerPcRef.current.close();
          const pc = new RTCPeerConnection(RTC_CONFIG);
          viewerPcRef.current = pc;
          pc.ontrack = (ev) => {
            setRemoteLiveConnected(true);
            if (remoteLiveVideoRef.current && ev.streams[0]) {
              remoteLiveVideoRef.current.srcObject = ev.streams[0];
            }
          };
          pc.onicecandidate = (ev) => {
            if (ev.candidate) {
              sendWsMessage({
                type: 'webrtc:ice',
                roomId: sig.roomId,
                targetUserId: sig.fromUserId,
                payload: ev.candidate,
              });
            }
          };
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWsMessage({
            type: 'webrtc:answer',
            roomId: sig.roomId,
            targetUserId: sig.fromUserId,
            payload: answer,
          });
        } else if (event === 'webrtc:answer' && isBroadcasterOfActiveLive) {
          const pc = livePeersRef.current.get(sig.fromUserId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
          }
        } else if (event === 'webrtc:ice') {
          const pc = isBroadcasterOfActiveLive
            ? livePeersRef.current.get(sig.fromUserId)
            : viewerPcRef.current;
          if (pc && sig.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(sig.payload as RTCIceCandidateInit)).catch(() => {});
          }
        }
      }

      // Handle 1:1 Consultation Call signaling
      if (activeConsultation && sig.roomId === `consult:${activeConsultation.id}`) {
        if (event === 'webrtc:offer') {
          let pc = consultPcRef.current;
          if (!pc) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => null);
            if (stream) {
              consultLocalStreamRef.current = stream;
              setConsultCallActive(true);
              setTimeout(() => {
                if (consultLocalVideoRef.current) consultLocalVideoRef.current.srcObject = stream;
              }, 40);
            }
            pc = new RTCPeerConnection(RTC_CONFIG);
            consultPcRef.current = pc;
            if (stream) {
              stream.getTracks().forEach((track) => pc!.addTrack(track, stream));
            }
            pc.ontrack = (ev) => {
              setConsultRemoteConnected(true);
              if (consultRemoteVideoRef.current && ev.streams[0]) {
                consultRemoteVideoRef.current.srcObject = ev.streams[0];
              }
            };
            pc.onicecandidate = (ev) => {
              if (ev.candidate) {
                sendWsMessage({ type: 'webrtc:ice', roomId: sig.roomId, payload: ev.candidate });
              }
            };
          }
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWsMessage({ type: 'webrtc:answer', roomId: sig.roomId, payload: answer });
        } else if (event === 'webrtc:answer' && consultPcRef.current) {
          await consultPcRef.current.setRemoteDescription(
            new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit)
          );
        } else if (event === 'webrtc:ice' && consultPcRef.current && sig.payload) {
          await consultPcRef.current
            .addIceCandidate(new RTCIceCandidate(sig.payload as RTCIceCandidateInit))
            .catch(() => {});
        } else if (event === 'webrtc:leave') {
          setConsultRemoteConnected(false);
        }
      }
    });
  }, [activeConsultation, activeLiveReader, isBroadcasterOfActiveLive, sendWsMessage, subscribeWsEvent]);

  // Load consultation chat history & cleanup on close
  useEffect(() => {
    if (!activeConsultation) {
      stopAudioRecording(false);
      stopConsultVideoCall();
      return;
    }
    apiFetch<{ messages: ChatMessage[] }>(`/api/chat/consult:${activeConsultation.id}`)
      .then((res) => setConsultMessages(res.messages))
      .catch(() => {});
  }, [activeConsultation, apiFetch, stopAudioRecording, stopConsultVideoCall]);

  // Load live chat history & signal join for viewers
  useEffect(() => {
    if (!activeLiveReader) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (viewerPcRef.current) {
        viewerPcRef.current.close();
        viewerPcRef.current = null;
      }
      for (const pc of livePeersRef.current.values()) {
        pc.close();
      }
      livePeersRef.current.clear();
      setCameraActive(false);
      setRemoteLiveConnected(false);
      return;
    }

    if (user) {
      apiFetch<{ messages: ChatMessage[] }>(`/api/chat/live:${activeLiveReader.id}`)
        .then((res) => setLiveMessages(res.messages))
        .catch(() => {});

      if (!isBroadcasterOfActiveLive) {
        sendWsMessage({ type: 'webrtc:join', roomId: `live:${activeLiveReader.id}` });
      }
    }
  }, [activeLiveReader, user, isBroadcasterOfActiveLive, apiFetch, sendWsMessage]);

  const handleOpenCartomancerOwnLive = async () => {
    if (!user || user.role !== 'cartomancer') return;
    setActiveLiveReader(user);
    setTimeout(() => {
      activateLiveMedia();
    }, 100);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setActiveModal('auth');
      return;
    }
    if (!bookingReader) return;
    setBookingBusy(true);
    try {
      const res = await apiFetch<{ consultation: Consultation }>('/api/consultations', {
        method: 'POST',
        body: JSON.stringify({
          cartomancerId: bookingReader.id,
          tier,
          question,
          scheduledAt,
          paymentMethod,
        }),
      });
      await refreshBootstrap();
      setBookingReader(null);
      setQuestion('');
      setActiveConsultation(res.consultation);
      notifyToast(
        'Pagamento aprovado e chat liberado',
        `Consulta confirmada com ${res.consultation.cartomancerName}.`,
        'success'
      );
    } catch (err) {
      notifyToast('Não foi possível agendar', err instanceof Error ? err.message : 'Tente novamente.', 'error');
    } finally {
      setBookingBusy(false);
    }
  };

  const handleSendConsultMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConsultation || !consultDraft.trim()) return;
    const text = consultDraft.trim();
    setConsultDraft('');
    try {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/chat/consult:${activeConsultation.id}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setConsultMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    } catch (err) {
      notifyToast('Erro no envio', err instanceof Error ? err.message : 'Falha ao enviar mensagem.', 'error');
    }
  };

  const handleSendLiveMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLiveReader || !liveDraft.trim()) return;
    if (!user) {
      setActiveModal('auth');
      return;
    }
    const text = liveDraft.trim();
    setLiveDraft('');
    try {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/chat/live:${activeLiveReader.id}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setLiveMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    } catch (err) {
      notifyToast('Erro no chat ao vivo', err instanceof Error ? err.message : 'Falha ao enviar.', 'error');
    }
  };

  const handleDrawLiveCard = async () => {
    if (!activeLiveReader || !isBroadcasterOfActiveLive) return;
    const card = MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
    const upright = Math.random() > 0.25;
    const existingCards = liveTables[activeLiveReader.id]?.cards || [];
    const nextCards: DrawnCardRecord[] = [
      ...existingCards.slice(-2),
      {
        id: card.id,
        name: card.name,
        numeral: card.numeral,
        upright,
        position: `Carta ${existingCards.length + 1}`,
        meaning: upright ? card.uprightMeaning : card.reversedMeaning,
      },
    ];
    try {
      await apiFetch('/api/cartomancer/live', {
        method: 'POST',
        body: JSON.stringify({
          isLive: true,
          drawnCards: nextCards,
        }),
      });
      notifyToast('Carta aberta na live', `${card.numeral} — ${card.name} exibida para todos os participantes.`, 'success');
    } catch (err) {
      notifyToast('Erro ao sortear carta', err instanceof Error ? err.message : 'Falha.', 'error');
    }
  };

  const selectedPrice =
    tier === 'one_question'
      ? 15
      : tier === 'three_questions'
      ? 50
      : bookingReader?.fullReadingPrice || 0;

  return (
    <section id="cartomantes" className="py-16 border-t border-[#E6DDF5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#6D28D9] mb-2">
              Atendimento Espiritual 24 Horas
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#2E1A47] text-balance">
              Cartomantes ao vivo, agendamento e atendimento direto
            </h2>
            <p className="text-sm sm:text-base text-[#5E4E80] mt-2 leading-relaxed">
              Escolha sua guia espiritual, assista às lives com vídeo e áudio, envie mensagens ou áudio no chat em tempo real e acesse atendimento via WhatsApp.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#EFE8FB] rounded-lg self-start">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'all' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80] hover:text-[#2E1A47]'
              }`}
            >
              Todas ({cartomancers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('live')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'live' ? 'bg-white text-[#BE185D] shadow-sm' : 'text-[#5E4E80] hover:text-[#2E1A47]'
              }`}
            >
              Ao Vivo Agora
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('approved_full')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'approved_full' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80] hover:text-[#2E1A47]'
              }`}
            >
              Jogo Completo Liberado
            </button>
          </div>
        </div>

        {/* Cartomancer-Only Studio & Incoming Questions Panel */}
        {isCartomancerUser && user && (
          <div className="mb-10 p-6 rounded-2xl bg-[#F3EEF9] border border-[#D4C3F2] space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#6D28D9]">Acesso Exclusivo da Cartomante</p>
                <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[#2E1A47]">
                  Estúdio Ao Vivo & Perguntas Recebidas
                </h3>
                <p className="text-xs text-[#5E4E80] mt-1 tabular-nums">
                  Sua tabela ativa: 1 Pergunta R$ 15,00 · 3 Perguntas R$ 50,00 · Jogo Completo{' '}
                  {user.fullReadingStatus === 'approved' && user.fullReadingPrice
                    ? `R$ ${user.fullReadingPrice},00`
                    : 'Em aprovação'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenCartomancerOwnLive}
                  className="px-4 py-2.5 rounded-lg bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Video className="w-4 h-4" />
                  <span>Abrir Live com Vídeo e Microfone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('profile')}
                  className="px-4 py-2.5 rounded-lg bg-white border border-[#DCD1EF] hover:bg-[#FDFBFF] text-[#4C1D95] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Editar Tabela & WhatsApp
                </button>
              </div>
            </div>

            {myCartomancerConsultations.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-[#E6DDF5] text-xs text-[#5E4E80]">
                Nenhuma pergunta agendada no momento. Quando um consulente pagar 1 Pergunta (R$ 15,00), 3 Perguntas (R$ 50,00) ou Jogo Completo, ela aparecerá aqui para resposta em texto, áudio ou vídeo.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myCartomancerConsultations.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl bg-white border border-[#E6DDF5] flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#6B5B8E]">
                        <span className="font-semibold text-[#2E1A47]">{c.userName}</span>
                        <span className="font-mono font-semibold text-[#6D28D9] tabular-nums">
                          {c.tier === 'one_question'
                            ? '1 Pergunta · R$ 15,00'
                            : c.tier === 'three_questions'
                            ? '3 Perguntas · R$ 50,00'
                            : `Jogo Completo · R$ ${c.price.toFixed(2).replace('.', ',')}`}
                        </span>
                      </div>
                      <p className="text-sm text-[#4B3A6B] mt-1.5 leading-relaxed">{c.question}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#F1EAFD]">
                      <span className="text-[11px] text-[#6B5B8E] tabular-nums">
                        {new Date(c.scheduledAt).toLocaleString('pt-BR')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveConsultation(c)}
                        className="px-3 py-1.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Responder (Chat / Áudio / Vídeo)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pricing summary strip */}
        <div id="planos" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="p-5 rounded-xl bg-white border border-[#E6DDF5] flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#6B5B8E]">Consulta Objetiva</p>
              <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">1 Pergunta</h3>
              <p className="text-xs text-[#5E4E80] mt-1">Resposta direta + áudio ou texto no chat</p>
            </div>
            <span className="font-mono text-xl font-semibold text-[#6D28D9] tabular-nums whitespace-nowrap">
              R$ 15,00
            </span>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#D4C3F2] flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#6D28D9]">Leitura Estendida</p>
              <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">3 Perguntas</h3>
              <p className="text-xs text-[#5E4E80] mt-1">Aprofundamento amor, trabalho e destino</p>
            </div>
            <span className="font-mono text-xl font-semibold text-[#6D28D9] tabular-nums whitespace-nowrap">
              R$ 50,00
            </span>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#E6DDF5] flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#B45309]">Mesa Real Completa</p>
              <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">Jogo Completo</h3>
              <p className="text-xs text-[#5E4E80] mt-1">Valor definido pela cartomante e aprovado pelo Admin</p>
            </div>
            <span className="font-mono text-sm font-semibold text-[#B45309] tabular-nums whitespace-nowrap">
              Sob medida
            </span>
          </div>
        </div>

        {/* Cartomancer cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReaders.map((reader) => {
            const isOnline = onlineSessions.some((s) => s.userId === reader.id) || reader.isLive;
            const isOwner = user?.role === 'cartomancer' && user.id === reader.id;
            const existingConsult = consultations.find(
              (c) => c.cartomancerId === reader.id && (user ? c.userId === user.id || c.cartomancerId === user.id : false)
            );

            return (
              <article
                key={reader.id}
                className="rounded-2xl bg-white border border-[#E6DDF5] overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div>
                  <div className="relative h-64 bg-[#EFE8FB] overflow-hidden">
                    <img
                      src={reader.avatar}
                      alt={`Retrato de ${reader.name}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1E1633]/80 via-[#1E1633]/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-2xl font-semibold leading-tight">{reader.name}</h3>
                        {reader.isLive && (
                          <button
                            type="button"
                            onClick={() => setActiveLiveReader(reader)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Radio className="w-3.5 h-3.5" />
                            <span>Ao Vivo</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-white/85 mt-1">
                        {reader.zodiacSign} · {reader.specialties?.slice(0, 2).join(' · ') || 'Tarot Integrativo'}
                      </p>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between text-xs text-[#6B5B8E] mb-3">
                      <span>{isOnline ? 'Disponível agora' : 'Atendimento agendado'}</span>
                      <span className="tabular-nums font-medium text-[#2E1A47]">
                        ★ {(reader.rating || 4.9).toFixed(1)} · {reader.totalReadings || 0} leituras
                      </span>
                    </div>

                    <p className="text-sm text-[#4B3A6B] leading-relaxed line-clamp-3">{reader.bio}</p>

                    <div className="mt-4 pt-4 border-t border-[#F1EAFD] flex items-center justify-between text-xs text-[#5E4E80] tabular-nums">
                      <span>1 Pergunta: R$ 15</span>
                      <span>·</span>
                      <span>3 Perguntas: R$ 50</span>
                      <span>·</span>
                      <span>
                        Completo:{' '}
                        {reader.fullReadingStatus === 'approved' && reader.fullReadingPrice
                          ? `R$ ${reader.fullReadingPrice}`
                          : 'Em análise'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={handleOpenCartomancerOwnLive}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Abrir Minha Live (Vídeo & Mic)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            setActiveModal('auth');
                            return;
                          }
                          setBookingReader(reader);
                          setTier('one_question');
                        }}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <CalendarClock className="w-4 h-4" />
                        <span>Agendar & Consultar</span>
                      </button>
                    )}

                    {reader.isLive && !isOwner && (
                      <button
                        type="button"
                        onClick={() => setActiveLiveReader(reader)}
                        className="py-2.5 px-3.5 rounded-lg border border-[#BE185D] text-[#BE185D] hover:bg-[#FDF2F8] text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Assistir Live
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {existingConsult && (
                      <button
                        type="button"
                        onClick={() => setActiveConsultation(existingConsult)}
                        className="flex-1 py-2 px-3 rounded-lg bg-[#F3EEF9] hover:bg-[#E7DDF7] text-[#4C1D95] text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Abrir Chat & Áudio</span>
                      </button>
                    )}

                    {reader.whatsappUrl && (
                      <a
                        href={reader.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-lg border border-[#D8CEEA] hover:bg-[#F7F3FC] text-[#2E1A47] text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                        <span>WhatsApp Direto</span>
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Booking & Integrated Payment Modal */}
      {bookingReader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#EDE7F6] flex items-center justify-between bg-[#F7F3FC]">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
                  Agendar com {bookingReader.name}
                </h3>
                <p className="text-xs text-[#6B5B8E]">
                  Pagamento integrado para liberar chat com texto, áudio e vídeo chamada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingReader(null)}
                aria-label="Fechar agendamento"
                className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-2">
                  Escolha o formato da consulta
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTier('one_question')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      tier === 'one_question'
                        ? 'border-[#6D28D9] bg-[#F3EEF9] text-[#2E1A47]'
                        : 'border-[#E6DDF5] bg-white text-[#5E4E80]'
                    }`}
                  >
                    <p className="text-xs font-semibold">1 Pergunta</p>
                    <p className="font-mono text-sm font-semibold text-[#6D28D9] mt-1 tabular-nums">R$ 15,00</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTier('three_questions')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      tier === 'three_questions'
                        ? 'border-[#6D28D9] bg-[#F3EEF9] text-[#2E1A47]'
                        : 'border-[#E6DDF5] bg-white text-[#5E4E80]'
                    }`}
                  >
                    <p className="text-xs font-semibold">3 Perguntas</p>
                    <p className="font-mono text-sm font-semibold text-[#6D28D9] mt-1 tabular-nums">R$ 50,00</p>
                  </button>

                  <button
                    type="button"
                    disabled={bookingReader.fullReadingStatus !== 'approved'}
                    onClick={() => setTier('full_deck')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      bookingReader.fullReadingStatus !== 'approved'
                        ? 'border-[#EDE7F6] bg-[#F9F7FD] text-[#9A8BB8] cursor-not-allowed'
                        : tier === 'full_deck'
                        ? 'border-[#6D28D9] bg-[#F3EEF9] text-[#2E1A47] cursor-pointer'
                        : 'border-[#E6DDF5] bg-white text-[#5E4E80] cursor-pointer'
                    }`}
                  >
                    <p className="text-xs font-semibold">Jogo Completo</p>
                    <p className="font-mono text-sm font-semibold text-[#B45309] mt-1 tabular-nums">
                      {bookingReader.fullReadingStatus === 'approved' && bookingReader.fullReadingPrice
                        ? `R$ ${bookingReader.fullReadingPrice},00`
                        : 'Em aprovação'}
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                    Data e Horário
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                    Forma de Pagamento
                  </label>
                  <div className="flex items-center gap-1 p-1 bg-[#F1EAFD] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={`flex-1 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                        paymentMethod === 'pix' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80]'
                      }`}
                    >
                      PIX Instantâneo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`flex-1 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                        paymentMethod === 'card' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80]'
                      }`}
                    >
                      Cartão
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                  Sua Pergunta ou Situação Atual
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={500}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Descreva sua dúvida sobre amor, trabalho, caminhos ou decisão espiritual..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                />
              </div>

              <div className="p-4 rounded-xl bg-[#F7F3FC] border border-[#E6DDF5] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#4B3A6B]">
                  <CreditCard className="w-4 h-4 text-[#6D28D9]" />
                  <span>Liberação automática de chat, áudio e vídeo chamada</span>
                </div>
                <span className="font-mono text-lg font-semibold text-[#2E1A47] tabular-nums">
                  R$ {selectedPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>

              <button
                type="submit"
                disabled={bookingBusy}
                className="w-full py-3 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {bookingBusy ? 'Confirmando pagamento...' : 'Confirmar Pagamento e Liberar Chat'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Real-Time Consultation Chat Modal (Text + Voice Audio + 1:1 Video Call) */}
      {activeConsultation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#EDE7F6] flex items-center justify-between gap-3 bg-[#F7F3FC]">
              <div className="min-w-0">
                <h3 className="font-display text-2xl font-semibold text-[#2E1A47] truncate">
                  Consulta · {user?.id === activeConsultation.cartomancerId ? activeConsultation.userName : activeConsultation.cartomancerName}
                </h3>
                <p className="text-xs text-[#6B5B8E]">
                  {activeConsultation.tier === 'one_question'
                    ? '1 Pergunta (R$ 15,00)'
                    : activeConsultation.tier === 'three_questions'
                    ? '3 Perguntas (R$ 50,00)'
                    : `Jogo Completo (R$ ${activeConsultation.price.toFixed(2).replace('.', ',')})`}{' '}
                  · Chat, Áudio & Vídeo
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={startConsultVideoCall}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    consultCallActive
                      ? 'bg-rose-700 text-white'
                      : 'bg-[#BE185D] hover:bg-[#9D174D] text-white'
                  }`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{consultCallActive ? 'Encerrar Vídeo' : 'Vídeo Chamada'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConsultation(null)}
                  aria-label="Fechar chat"
                  className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {consultCallActive && (
              <div className="p-3 bg-[#2E1A47] grid grid-cols-2 gap-3">
                <div className="relative rounded-lg overflow-hidden bg-black/40 aspect-video">
                  <video ref={consultLocalVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <span className="absolute bottom-1.5 left-2 text-[11px] text-white/90">Você</span>
                </div>
                <div className="relative rounded-lg overflow-hidden bg-black/40 aspect-video flex items-center justify-center">
                  <video ref={consultRemoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  {!consultRemoteConnected && (
                    <span className="absolute text-xs text-white/80 px-2 text-center">
                      Aguardando conexão de vídeo da outra parte...
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F9F7FD]">
              <div className="p-3.5 rounded-xl bg-white border border-[#E6DDF5] text-xs text-[#4B3A6B]">
                <span className="font-semibold text-[#2E1A47]">Pergunta inicial:</span> {activeConsultation.question}
              </div>

              {consultMessages.map((msg) => {
                const isMine = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm ${
                        isMine
                          ? 'bg-[#6D28D9] text-white'
                          : 'bg-white border border-[#E6DDF5] text-[#2E1A47]'
                      }`}
                    >
                      <p className={`text-[11px] font-semibold mb-1 ${isMine ? 'text-white/80' : 'text-[#6D28D9]'}`}>
                        {msg.senderName}
                      </p>
                      {msg.audioDataUrl ? (
                        <div className="space-y-1.5">
                          <audio controls src={msg.audioDataUrl} className="max-w-full h-9" />
                          {msg.audioDurationSec && (
                            <p className={`text-[11px] tabular-nums ${isMine ? 'text-white/80' : 'text-[#6B5B8E]'}`}>
                              Áudio · {msg.audioDurationSec}s
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="leading-relaxed">{msg.text}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendConsultMsg} className="p-4 border-t border-[#EDE7F6] bg-white flex items-center gap-2">
              {recordingAudio ? (
                <div className="flex-1 flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="text-xs font-semibold text-rose-800 tabular-nums">
                    Gravando áudio · 0:{String(recordingSeconds).padStart(2, '0')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stopAudioRecording(false)}
                      aria-label="Cancelar gravação"
                      className="p-1.5 rounded-md text-rose-700 hover:bg-rose-100 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => stopAudioRecording(true)}
                      className="px-3 py-1.5 rounded-md bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Enviar Áudio</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={sendingAudio}
                    onClick={startAudioRecording}
                    title="Gravar mensagem de áudio"
                    aria-label="Gravar mensagem de áudio"
                    className="p-2.5 rounded-lg border border-[#DCD1EF] hover:bg-[#F3EEF9] text-[#6D28D9] cursor-pointer shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={consultDraft}
                    onChange={(e) => setConsultDraft(e.target.value)}
                    placeholder={sendingAudio ? 'Enviando áudio...' : 'Escreva sua mensagem ou grave um áudio...'}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar</span>
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Live Video Call & Tarot Table Modal (Cartomancer-Only Broadcaster Controls) */}
      {activeLiveReader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-[#EDE7F6] flex items-center justify-between bg-[#F7F3FC]">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#BE185D]">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Vídeo Chamada Ao Vivo · {activeLiveReader.name}</span>
                </div>
                <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
                  {activeLiveReader.liveTitle || 'Tiragem Coletiva em Tempo Real'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveLiveReader(null)}
                aria-label="Sair da transmissão"
                className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 flex-1 overflow-hidden">
              {/* Stage + Drawn cards */}
              <div className="lg:col-span-3 p-5 bg-[#F5F0FC] flex flex-col justify-between gap-4 overflow-y-auto">
                <div className="relative rounded-xl overflow-hidden border border-[#DCD1EF] bg-[#2E1A47] aspect-video flex items-center justify-center">
                  {isBroadcasterOfActiveLive && cameraActive ? (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  ) : !isBroadcasterOfActiveLive && remoteLiveConnected ? (
                    <video ref={remoteLiveVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img
                      src={activeLiveReader.avatar}
                      alt={activeLiveReader.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-85"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1E1633]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
                    <span>
                      {isBroadcasterOfActiveLive
                        ? cameraActive
                          ? `Transmitindo vídeo + ${micMuted ? 'mic mutado' : 'mic ativo'}`
                          : 'Clique em "Ativar Vídeo & Microfone" para iniciar'
                        : remoteLiveConnected
                        ? `Assistindo vídeo e áudio ao vivo de ${activeLiveReader.name}`
                        : `Mesa Espiritual de ${activeLiveReader.name}`}
                    </span>
                    <span className="tabular-nums">{onlineSessions.length} conectados</span>
                  </div>
                </div>

                {/* Live drawn cards table */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#524373]">
                      Cartas Abertas na Mesa
                    </h4>

                    {/* Strictly Cartomancer-Only Broadcaster Controls */}
                    {isBroadcasterOfActiveLive && (
                      <div className="flex flex-wrap items-center gap-2">
                        {cameraActive ? (
                          <>
                            <button
                              type="button"
                              onClick={toggleMicMute}
                              className="px-3 py-1.5 rounded-lg border border-[#DCD1EF] bg-white text-xs font-semibold text-[#2E1A47] inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              {micMuted ? <MicOff className="w-3.5 h-3.5 text-rose-700" /> : <Mic className="w-3.5 h-3.5 text-emerald-700" />}
                              <span>{micMuted ? 'Ativar Mic' : 'Mic Ativo'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopLiveBroadcast}
                              className="px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <VideoOff className="w-3.5 h-3.5" />
                              <span>Encerrar Vídeo</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={activateLiveMedia}
                            className="px-3 py-1.5 rounded-lg bg-[#BE185D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Ativar Vídeo & Microfone</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDrawLiveCard}
                          className="px-3 py-1.5 rounded-lg bg-[#6D28D9] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Sortear Carta</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(liveTables[activeLiveReader.id]?.cards || []).length === 0 ? (
                      <div className="sm:col-span-3 p-4 rounded-xl bg-white/80 border border-[#E6DDF5] text-xs text-[#6B5B8E] text-center">
                        Aguardando a próxima tiragem na mesa ao vivo. Participe pelo chat ao lado.
                      </div>
                    ) : (
                      (liveTables[activeLiveReader.id]?.cards || []).map((c, idx) => (
                        <div key={`${c.id}-${idx}`} className="p-3 rounded-xl bg-white border border-[#DCD1EF]">
                          <p className="text-[11px] font-semibold text-[#6D28D9]">
                            {c.numeral} · {c.upright ? 'Normal' : 'Invertida'}
                          </p>
                          <p className="font-display text-lg font-semibold text-[#2E1A47]">{c.name}</p>
                          <p className="text-xs text-[#5E4E80] mt-1 line-clamp-3">{c.meaning}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Live chat */}
              <div className="lg:col-span-2 flex flex-col border-l border-[#EDE7F6] bg-white min-h-[300px]">
                <div className="px-4 py-3 border-b border-[#F1EAFD] text-xs font-semibold text-[#4B3A6B]">
                  Chat da Transmissão
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[340px]">
                  {!user && (
                    <div className="p-3 rounded-lg bg-[#F7F3FC] text-xs text-[#5E4E80]">
                      Entre na sua conta para conversar em tempo real durante a live.
                    </div>
                  )}
                  {liveMessages.map((m) => (
                    <div key={m.id} className="text-xs">
                      <span className="font-semibold text-[#6D28D9]">{m.senderName}: </span>
                      <span className="text-[#2E1A47]">{m.text}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendLiveMsg} className="p-3 border-t border-[#EDE7F6] flex items-center gap-2">
                  <input
                    type="text"
                    value={liveDraft}
                    onChange={(e) => setLiveDraft(e.target.value)}
                    placeholder={user ? 'Enviar mensagem na live...' : 'Entre para comentar'}
                    className="flex-1 px-3 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-[#6D28D9] text-white text-xs font-semibold cursor-pointer"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
