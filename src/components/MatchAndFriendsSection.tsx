import React, { useEffect, useState } from 'react';
import { HeartHandshake, MessageCircle, Send, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateAstrologicalCompatibility } from '../data/zodiac';
import type { ChatMessage } from '../types';

export function MatchAndFriendsSection() {
  const {
    user,
    members,
    friendships,
    matches,
    swipedIds,
    setActiveModal,
    notifyToast,
    apiFetch,
    refreshBootstrap,
    subscribeWsEvent,
  } = useApp();

  const [tab, setTab] = useState<'match' | 'friends'>('match');
  const [activeRoom, setActiveRoom] = useState<{
    roomId: string;
    title: string;
    subtitle: string;
  } | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const otherMembers = members.filter((m) => m.id !== user?.id);
  const candidateProfiles = otherMembers.filter((m) => !swipedIds.includes(m.id));
  const currentCandidate = candidateProfiles[0] || otherMembers[0];

  useEffect(() => {
    return subscribeWsEvent((event, data) => {
      if (event !== 'chat:message' || !activeRoom) return;
      const msg = data as ChatMessage;
      if (msg.roomId === activeRoom.roomId) {
        setRoomMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
    });
  }, [activeRoom, subscribeWsEvent]);

  useEffect(() => {
    if (!activeRoom || !user) return;
    apiFetch<{ messages: ChatMessage[] }>(`/api/chat/${activeRoom.roomId}`)
      .then((res) => setRoomMessages(res.messages))
      .catch(() => {});
  }, [activeRoom, user, apiFetch]);

  const handleMatchAction = async (targetId: string, action: 'like' | 'pass') => {
    if (!user) {
      setActiveModal('auth');
      return;
    }
    try {
      const res = await apiFetch<{ match: { id: string; compatibilityScore: number } | null }>('/api/matches/action', {
        method: 'POST',
        body: JSON.stringify({ targetId, action }),
      });
      await refreshBootstrap();
      if (res.match) {
        notifyToast(
          `Match Astral! (${res.match.compatibilityScore}%)`,
          'Sinastria confirmada. O chat de encontro já está liberado.',
          'success'
        );
      } else if (action === 'like') {
        notifyToast('Interesse enviado', 'Se houver reciprocidade astral, o match será ativado.', 'info');
      }
    } catch (err) {
      notifyToast('Erro', err instanceof Error ? err.message : 'Tente novamente.', 'error');
    }
  };

  const handleAddFriend = async (recipientId: string, recipientName: string) => {
    if (!user) {
      setActiveModal('auth');
      return;
    }
    try {
      await apiFetch('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ recipientId }),
      });
      await refreshBootstrap();
      notifyToast('Amizade conectada', `Você e ${recipientName} agora podem conversar no chat privado.`, 'success');
    } catch (err) {
      notifyToast('Erro ao conectar', err instanceof Error ? err.message : 'Tente novamente.', 'error');
    }
  };

  const openPrivateFriendChat = (friendId: string, friendName: string, friendSign: string) => {
    if (!user) return;
    const sorted = [user.id, friendId].sort();
    setActiveRoom({
      roomId: `dm:${sorted[0]}__${sorted[1]}`,
      title: `Chat Privado · ${friendName}`,
      subtitle: `Amizade Celestial · Signo de ${friendSign}`,
    });
  };

  const openMatchChat = (matchId: string, partnerName: string, score: number, summary: string) => {
    setActiveRoom({
      roomId: `match:${matchId}`,
      title: `Encontro Astral · ${partnerName}`,
      subtitle: `Compatibilidade ${score}% · ${summary}`,
    });
  };

  const handleSendRoomMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    try {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/chat/${activeRoom.roomId}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setRoomMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    } catch (err) {
      notifyToast('Erro ao enviar', err instanceof Error ? err.message : 'Tente novamente.', 'error');
    }
  };

  const candidateCompatibility = currentCandidate
    ? calculateAstrologicalCompatibility(
        user?.zodiacSign || 'Peixes',
        user?.interests || ['Tarot', 'Astrologia'],
        currentCandidate.zodiacSign,
        currentCandidate.interests
      )
    : null;

  return (
    <section id="match-astral" className="py-16 border-t border-[#E6DDF5] bg-[#F5F0FC]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#BE185D] mb-2">
              Sinastria, Encontros & Amizades
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#2E1A47] text-balance">
              Match astrológico de namoro e chat privado entre membros
            </h2>
            <p className="text-sm sm:text-base text-[#5E4E80] mt-2 leading-relaxed">
              Descubra afinidades por signo solar, elementos e interesses místicos, forme matches amorosos ou cultive amizades com conversas privadas em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#EFE8FB] rounded-lg self-start">
            <button
              type="button"
              onClick={() => setTab('match')}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'match' ? 'bg-white text-[#BE185D] shadow-sm' : 'text-[#5E4E80]'
              }`}
            >
              Match Astral & Namoro
            </button>
            <button
              type="button"
              onClick={() => setTab('friends')}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'friends' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80]'
              }`}
            >
              Amizades & Chat Privado
            </button>
          </div>
        </div>

        {tab === 'match' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Astrological Match Card */}
            <div className="lg:col-span-6">
              {currentCandidate && candidateCompatibility ? (
                <div className="rounded-2xl bg-white border border-[#E6DDF5] overflow-hidden">
                  <div className="relative h-72 bg-[#EFE8FB]">
                    <img
                      src={currentCandidate.avatar}
                      alt={currentCandidate.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1E1633]/85 via-[#1E1633]/25 to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5 text-white">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <h3 className="font-display text-3xl font-semibold">{currentCandidate.name}</h3>
                          <p className="text-xs text-white/85 mt-1">
                            Sol em {currentCandidate.zodiacSign} · Ascendente {currentCandidate.ascendant} · Lua em {currentCandidate.moonSign}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-2xl font-semibold text-[#FDE68A] tabular-nums">
                            {candidateCompatibility.score}%
                          </span>
                          <p className="text-[11px] text-white/80">Sinastria</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <p className="text-sm text-[#4B3A6B] leading-relaxed">{currentCandidate.bio}</p>

                    <div className="p-4 rounded-xl bg-[#FDF2F8] border border-[#FBCFE8]">
                      <p className="text-xs font-semibold text-[#9D174D]">Leitura de Compatibilidade</p>
                      <p className="text-xs text-[#6B214A] mt-1 leading-relaxed">{candidateCompatibility.summary}</p>
                    </div>

                    <p className="text-xs text-[#6B5B8E]">
                      Interesses: {currentCandidate.interests.join(' · ')}
                    </p>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleMatchAction(currentCandidate.id, 'pass')}
                        className="flex-1 py-2.5 px-4 rounded-lg border border-[#DCD1EF] hover:bg-[#F7F3FC] text-[#524373] text-sm font-semibold cursor-pointer"
                      >
                        Próximo Perfil
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMatchAction(currentCandidate.id, 'like')}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-[#BE185D] hover:bg-[#9D174D] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        <span>Conectar Match</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white border border-[#E6DDF5] text-center">
                  <p className="text-sm text-[#5E4E80]">Nenhum perfil disponível no momento.</p>
                </div>
              )}
            </div>

            {/* Active Matches & Dating Chat */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
                    Seus Matches & Chat de Encontro
                  </h3>
                  <p className="text-xs text-[#6B5B8E]">
                    Conversas afetivas liberadas por afinidade astrológica
                  </p>
                </div>
                <Sparkles className="w-5 h-5 text-[#BE185D]" />
              </div>

              {!user ? (
                <div className="p-6 rounded-xl bg-[#F9F7FD] border border-[#EDE7F6] text-center space-y-3">
                  <p className="text-sm text-[#4B3A6B]">
                    Entre com seu Gmail ou e-mail para ativar seu mapa astral e conversar com seus matches.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveModal('auth')}
                    className="px-4 py-2 rounded-lg bg-[#BE185D] text-white text-xs font-semibold cursor-pointer"
                  >
                    Entrar no Match Astral
                  </button>
                </div>
              ) : matches.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#F9F7FD] border border-[#EDE7F6] text-center">
                  <p className="text-sm text-[#5E4E80]">
                    Clique em "Conectar Match" ao lado para iniciar conexões baseadas no seu signo ({user.zodiacSign}).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((m) => {
                    const partnerId = m.userAId === user.id ? m.userBId : m.userAId;
                    const partner = members.find((u) => u.id === partnerId);
                    if (!partner) return null;
                    return (
                      <div
                        key={m.id}
                        className="p-4 rounded-xl bg-[#FDFBFF] border border-[#E6DDF5] flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={partner.avatar}
                            alt={partner.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#2E1A47] truncate">
                              {partner.name} · <span className="text-[#BE185D] font-mono tabular-nums">{m.compatibilityScore}%</span>
                            </p>
                            <p className="text-xs text-[#6B5B8E] truncate">
                              {partner.zodiacSign} · {m.synastrySummary}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openMatchChat(m.id, partner.name, m.compatibilityScore, m.synastrySummary)}
                          className="px-3.5 py-2 rounded-lg bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Conversar</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Friendships & Private Member Chat */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {otherMembers.map((member) => {
              const isFriend = user
                ? friendships.some(
                    (f) =>
                      f.status === 'accepted' &&
                      ((f.requesterId === user.id && f.recipientId === member.id) ||
                        (f.requesterId === member.id && f.recipientId === user.id))
                  )
                : false;

              return (
                <div key={member.id} className="p-5 rounded-2xl bg-white border border-[#E6DDF5] flex flex-col justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border border-[#DFD4F2] shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-[#2E1A47] truncate">{member.name}</h3>
                      <p className="text-xs text-[#6B5B8E]">
                        {member.zodiacSign} · Asc. {member.ascendant}
                      </p>
                      <p className="text-xs text-[#4B3A6B] mt-2 line-clamp-2 leading-relaxed">{member.bio}</p>
                    </div>
                  </div>

                  {isFriend ? (
                    <button
                      type="button"
                      onClick={() => openPrivateFriendChat(member.id, member.name, member.zodiacSign)}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Abrir Chat Privado</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddFriend(member.id, member.name)}
                      className="w-full py-2.5 px-4 rounded-lg border border-[#DCD1EF] hover:bg-[#F3EEF9] text-[#4C1D95] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Adicionar Amigo</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Private Friend / Astro Match Real-Time Chat Modal */}
      {activeRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-[#EDE7F6] flex items-center justify-between bg-[#F7F3FC]">
              <div className="min-w-0">
                <h3 className="font-display text-2xl font-semibold text-[#2E1A47] truncate">{activeRoom.title}</h3>
                <p className="text-xs text-[#6B5B8E] truncate">{activeRoom.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRoom(null)}
                aria-label="Fechar conversa"
                className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F9F7FD] min-h-[260px]">
              {roomMessages.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6B5B8E]">
                  <Users className="w-5 h-5 mx-auto mb-2 text-[#6D28D9]" />
                  <span>Inicie a conversa enviando sua primeira mensagem celestial.</span>
                </div>
              ) : (
                roomMessages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                          isMine
                            ? 'bg-[#6D28D9] text-white'
                            : 'bg-white border border-[#E6DDF5] text-[#2E1A47]'
                        }`}
                      >
                        <p className={`text-[11px] font-semibold mb-0.5 ${isMine ? 'text-white/80' : 'text-[#6D28D9]'}`}>
                          {msg.senderName}
                        </p>
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendRoomMsg} className="p-4 border-t border-[#EDE7F6] bg-white flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
