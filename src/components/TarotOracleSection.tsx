import { useState } from 'react';
import { BookOpen, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MAJOR_ARCANA } from '../data/tarotDeck';
import type { DrawnCardRecord, ReadingHistoryItem } from '../types';

export function TarotOracleSection() {
  const { user, readingsHistory, consultations, setActiveModal, notifyToast, apiFetch, refreshBootstrap } = useApp();
  const [spreadType, setSpreadType] = useState<'daily_1' | 'trinity_3'>('trinity_3');
  const [question, setQuestion] = useState('');
  const [drawnCards, setDrawnCards] = useState<DrawnCardRecord[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [interpretation, setInterpretation] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDrawCards = () => {
    const count = spreadType === 'daily_1' ? 1 : 3;
    const positions =
      spreadType === 'daily_1'
        ? ['Energia Central do Momento']
        : ['Passado & Raiz', 'Presente & Movimento', 'Tendência Futura'];

    const pool = [...MAJOR_ARCANA];
    const picked: DrawnCardRecord[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const card = pool.splice(idx, 1)[0];
      const upright = Math.random() > 0.22;
      picked.push({
        id: card.id,
        name: card.name,
        numeral: card.numeral,
        upright,
        position: positions[i],
        meaning: upright ? card.uprightMeaning : card.reversedMeaning,
      });
    }

    const summaryLines = picked.map(
      (c) => `${c.position}: ${c.numeral} — ${c.name} (${c.upright ? 'Posição Direta' : 'Invertida'}) — ${c.meaning}`
    );
    const fullText = `${
      question.trim() ? `Intenção mentalizada: "${question.trim()}".\n\n` : ''
    }${summaryLines.join('\n\n')}`;

    setDrawnCards(picked);
    setInterpretation(fullText);
    setRevealed(false);
    setTimeout(() => setRevealed(true), 120);
  };

  const handleSaveReading = async () => {
    if (!user) {
      setActiveModal('auth');
      return;
    }
    if (drawnCards.length === 0) return;
    setSaving(true);
    try {
      await apiFetch<{ reading: ReadingHistoryItem }>('/api/readings', {
        method: 'POST',
        body: JSON.stringify({
          spreadType,
          question: question.trim() || 'Orientação espiritual do dia',
          cards: drawnCards,
          interpretation,
        }),
      });
      await refreshBootstrap();
      notifyToast('Leitura salva no histórico', 'Você pode consultar esta tiragem a qualquer momento.', 'success');
    } catch (err) {
      notifyToast('Erro ao salvar leitura', err instanceof Error ? err.message : 'Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="oraculo" className="py-16 border-t border-[#E6DDF5] bg-[#F5F0FC]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Interactive Tarot Studio */}
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#6D28D9] mb-2">
              Oráculo Interativo dos Arcanos Maiores
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#2E1A47] text-balance">
              Leitura de cartas e interpretação armazenada
            </h2>
            <p className="text-sm text-[#5E4E80] mt-2 leading-relaxed">
              Mentalize sua questão, escolha a tiragem de 1 carta ou 3 tempos e registre a interpretação diretamente no seu histórico pessoal.
            </p>

            <div className="mt-6 p-6 rounded-2xl bg-white border border-[#E6DDF5]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-1 p-1 bg-[#F1EAFD] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSpreadType('daily_1')}
                    className={`px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      spreadType === 'daily_1' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80]'
                    }`}
                  >
                    Carta do Dia (1 Carta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpreadType('trinity_3')}
                    className={`px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      spreadType === 'trinity_3' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80]'
                    }`}
                  >
                    Passado · Presente · Futuro (3 Cartas)
                  </button>
                </div>

                {drawnCards.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDrawCards}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6D28D9] hover:text-[#4C1D95] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Embaralhar Novamente</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="text"
                  maxLength={240}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Digite sua pergunta ou intenção antes de abrir as cartas..."
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                />
                <button
                  type="button"
                  onClick={handleDrawCards}
                  className="px-5 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Tirar Cartas</span>
                </button>
              </div>

              {drawnCards.length === 0 ? (
                <div className="rounded-xl overflow-hidden border border-[#E6DDF5] bg-[#F9F7FD]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 items-center">
                    <img
                      src="/src/assets/images/tarot_deck_artwork_1795241297829.jpg"
                      alt="Baralho de tarot celestial disposto sobre tecido lilás"
                      referrerPolicy="no-referrer"
                      className="w-full h-52 object-cover"
                    />
                    <div className="p-6">
                      <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
                        Mesa pronta para sua tiragem
                      </h3>
                      <p className="text-sm text-[#5E4E80] mt-2 leading-relaxed">
                        Todos os 22 Arcanos Maiores estão alinhados. Clique em "Tirar Cartas" para revelar sua mensagem.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={`grid gap-4 ${drawnCards.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-1 sm:grid-cols-3'}`}>
                    {drawnCards.map((card, index) => (
                      <div key={`${card.id}-${index}`} className="tarot-perspective h-64">
                        <div className={`tarot-card-inner relative w-full h-full ${revealed ? 'is-flipped' : ''}`}>
                          {/* Back of card */}
                          <div className="tarot-face absolute inset-0 rounded-xl border border-[#C89B3C]/60 bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#4338CA] p-4 flex flex-col items-center justify-center text-center text-[#FDE68A]">
                            <div className="w-full h-full rounded-lg border border-[#FDE68A]/35 flex flex-col items-center justify-center p-3">
                              <span className="font-display text-2xl">✦</span>
                              <span className="text-xs mt-2 tracking-widest uppercase">Cartomantes 24h</span>
                            </div>
                          </div>

                          {/* Revealed face */}
                          <div className="tarot-face tarot-face-back absolute inset-0 rounded-xl border border-[#D9C7F5] bg-gradient-to-b from-[#FDFBFF] to-[#F3EEF9] p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#6D28D9]">
                              <span>{card.position}</span>
                              <span>{card.upright ? 'Direta' : 'Invertida'}</span>
                            </div>
                            <div className="text-center my-2">
                              <p className="font-mono text-xs text-[#B45309]">{card.numeral}</p>
                              <h4 className="font-display text-2xl font-semibold text-[#2E1A47] mt-0.5">
                                {card.name}
                              </h4>
                            </div>
                            <p className="text-xs text-[#4B3A6B] leading-relaxed line-clamp-4">
                              {card.meaning}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-[#F9F7FD] border border-[#E6DDF5] space-y-3">
                    <h4 className="font-display text-xl font-semibold text-[#2E1A47]">
                      Síntese da Leitura
                    </h4>
                    <p className="text-sm text-[#4B3A6B] whitespace-pre-line leading-relaxed">
                      {interpretation}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-[#6B5B8E]">
                        {user
                          ? 'Salve no banco de dados para rever sua evolução.'
                          : 'Entre com seu Gmail/e-mail para salvar seu histórico.'}
                      </span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveReading}
                        className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Salvando...' : 'Salvar no Histórico'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Persistent History Column */}
          <div className="lg:col-span-5">
            <div className="p-6 rounded-2xl bg-white border border-[#E6DDF5]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
                    Histórico de Consultas & Leituras
                  </h3>
                  <p className="text-xs text-[#6B5B8E]">
                    Registro salvo na sua conta pessoal
                  </p>
                </div>
                <BookOpen className="w-5 h-5 text-[#6D28D9]" />
              </div>

              {!user ? (
                <div className="p-6 rounded-xl bg-[#F9F7FD] border border-[#EDE7F6] text-center space-y-3">
                  <p className="text-sm text-[#4B3A6B]">
                    Entre na sua conta para guardar suas interpretações de tarot e acompanhar consultas agendadas.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveModal('auth')}
                    className="px-4 py-2 rounded-lg bg-[#6D28D9] text-white text-xs font-semibold cursor-pointer"
                  >
                    Entrar para Salvar Histórico
                  </button>
                </div>
              ) : readingsHistory.length === 0 && consultations.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#F9F7FD] border border-[#EDE7F6] text-center">
                  <p className="text-sm text-[#5E4E80]">
                    Nenhuma leitura registrada ainda. Faça sua primeira tiragem ao lado ou agende com um cartomante.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
                  {consultations.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl bg-[#F7F3FC] border border-[#E6DDF5]">
                      <div className="flex items-center justify-between text-xs text-[#6B5B8E] mb-1">
                        <span>Consulta · {c.cartomancerName}</span>
                        <span className="font-mono tabular-nums">
                          R$ {c.price.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#2E1A47]">{c.question}</p>
                      <p className="text-[11px] text-[#6D28D9] mt-1">
                        {new Date(c.scheduledAt).toLocaleString('pt-BR')} · Pagamento confirmado
                      </p>
                    </div>
                  ))}

                  {readingsHistory.map((item) => (
                    <div key={item.id} className="p-4 rounded-xl bg-[#FDFBFF] border border-[#E6DDF5]">
                      <div className="flex items-center justify-between text-xs text-[#6B5B8E] mb-1">
                        <span>{item.spreadType === 'daily_1' ? 'Carta do Dia' : 'Tiragem 3 Tempos'}</span>
                        <span className="tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#2E1A47] mb-2">{item.question}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-[#6D28D9] font-medium mb-2">
                        {item.cards.map((c, idx) => (
                          <span key={idx}>
                            {c.numeral} {c.name}
                            {idx < item.cards.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-[#5E4E80] line-clamp-3 leading-relaxed">
                        {item.interpretation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
