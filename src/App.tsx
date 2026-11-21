import React, { useState } from 'react';
import { BellRing, Sparkles, X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { CartomancerSection } from './components/CartomancerSection';
import { TarotOracleSection } from './components/TarotOracleSection';
import { CommunitySection } from './components/CommunitySection';
import { MatchAndFriendsSection } from './components/MatchAndFriendsSection';
import { ProfileAndAccountModal } from './components/ProfileAndAccountModal';
import { AdminDashboard } from './components/AdminDashboard';

class PortalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9F7FD] p-6 text-center">
          <div className="max-w-md p-8 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
            <h1 className="font-display text-3xl font-semibold text-[#2E1A47]">
              Cartomantes 24h
            </h1>
            <p className="text-sm text-[#5E4E80]">
              Ocorreu uma instabilidade momentânea na tela. Recarregue a página para restabelecer sua conexão celestial.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-[#6D28D9] text-white text-sm font-semibold cursor-pointer"
            >
              Recarregar Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ToastStack() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`p-4 rounded-xl border shadow-lg bg-white flex items-start justify-between gap-3 ${
            t.kind === 'error'
              ? 'border-rose-300'
              : t.kind === 'success'
              ? 'border-emerald-300'
              : 'border-[#D4C3F2]'
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#2E1A47]">{t.title}</p>
            {t.body && <p className="text-xs text-[#5E4E80] mt-0.5 leading-relaxed">{t.body}</p>}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Fechar aviso"
            className="p-1 rounded text-[#7C6B9E] hover:text-[#2E1A47] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PortalContent() {
  const {
    user,
    onlineSessions,
    cartomancers,
    pushEnabled,
    enablePushNotifications,
    setActiveModal,
  } = useApp();
  const [activeView, setActiveView] = useState<'portal' | 'admin'>('portal');

  const handleSelectView = (view: 'portal' | 'admin', sectionId?: string) => {
    setActiveView(view);
    if (view === 'portal' && sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    }
  };

  const liveCount = cartomancers.filter((c) => c.isLive).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F7FD] text-[#1E1633]">
      <Header activeView={activeView} onSelectView={handleSelectView} />

      {activeView === 'admin' && user && (user.role === 'admin' || user.role === 'subadmin') ? (
        <main className="flex-1">
          <AdminDashboard onBackToPortal={() => setActiveView('portal')} />
        </main>
      ) : (
        <main className="flex-1">
          {/* Luminous Celestial Hero Section */}
          <section id="inicio" className="py-12 lg:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-between py-2">
                  <div>
                    <p className="text-xs font-semibold tracking-wider uppercase text-[#6D28D9] mb-3">
                      Santuário Celestial · Atendimento 24 Horas
                    </p>
                    <h1
                      className="font-display font-semibold text-[#2E1A47] leading-[1.08] text-balance"
                      style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)' }}
                    >
                      Clareza espiritual, tarot ao vivo e conexões de alma a qualquer hora
                    </h1>
                    <p className="text-base text-[#4B3A6B] mt-5 leading-relaxed max-w-xl">
                      Converse por chat em tempo real ou WhatsApp com cartomantes verificados, acompanhe lives místicas, guarde suas tiragens de tarot e encontre afinidades pelo mapa astral.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <a
                      href="#cartomantes"
                      className="px-6 py-3 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Consultar Cartomantes 24h</span>
                    </a>

                    <a
                      href="#oraculo"
                      className="px-5 py-3 rounded-lg border border-[#D4C3F2] bg-white hover:bg-[#F3EEF9] text-[#4C1D95] text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      Tirar Cartas Agora
                    </a>

                    {!pushEnabled && (
                      <button
                        type="button"
                        onClick={enablePushNotifications}
                        className="text-xs font-semibold text-[#6D28D9] hover:underline inline-flex items-center gap-1.5 cursor-pointer py-2"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Ativar alertas push</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="relative rounded-2xl overflow-hidden border border-[#DFD4F2] bg-[#EFE8FB] h-72 sm:h-96 lg:h-full min-h-[340px]">
                    <img
                      src="/src/assets/images/hero_celestial_sanctuary_1795241298030.jpg"
                      alt="Mesa celestial com cartas de tarot douradas, cristal de quartzo e lavanda sob luz da manhã"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2E1A47]/65 via-transparent to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium">
                        {liveCount > 0 ? `${liveCount} transmissão ao vivo agora` : 'Atendimento ativo 24h'}
                      </span>
                      <span className="tabular-nums text-white/90">
                        {onlineSessions.length} membros conectados em tempo real
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full-width 4-column spiritual strip below hero */}
              <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-[#E6DDF5]">
                <div>
                  <p className="text-xs text-[#6B5B8E]">Consulta Rápida</p>
                  <p className="font-display text-2xl font-semibold text-[#2E1A47] mt-0.5 tabular-nums">
                    1 Pergunta · R$ 15
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B5B8E]">Leitura Completa</p>
                  <p className="font-display text-2xl font-semibold text-[#2E1A47] mt-0.5 tabular-nums">
                    3 Perguntas · R$ 50
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B5B8E]">Canal Seguro</p>
                  <p className="font-display text-2xl font-semibold text-[#2E1A47] mt-0.5">
                    Chat & WhatsApp Direto
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B5B8E]">Comunidade & Sinastria</p>
                  <p className="font-display text-2xl font-semibold text-[#2E1A47] mt-0.5">
                    Match Astral & Amigos
                  </p>
                </div>
              </div>
            </div>
          </section>

          <CartomancerSection />
          <TarotOracleSection />
          <CommunitySection />
          <MatchAndFriendsSection />
        </main>
      )}

      <footer className="border-t border-[#E6DDF5] bg-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-display text-2xl font-semibold text-[#2E1A47]">Cartomantes 24h</p>
            <p className="text-xs text-[#6B5B8E] mt-1">
              Tarot, Astrologia, Comunidade Espiritual e Atendimento em Tempo Real.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#524373]">
            <a href="#cartomantes" className="hover:text-[#6D28D9]">
              Cartomantes
            </a>
            <a href="#oraculo" className="hover:text-[#6D28D9]">
              Tarot & Histórico
            </a>
            <a href="#comunidade" className="hover:text-[#6D28D9]">
              Comunidade
            </a>
            <a href="#match-astral" className="hover:text-[#6D28D9]">
              Match Astral
            </a>
            {!user && (
              <button
                type="button"
                onClick={() => setActiveModal('auth')}
                className="text-[#6D28D9] font-semibold hover:underline cursor-pointer"
              >
                Entrar / Configurar Admin
              </button>
            )}
          </div>
        </div>
      </footer>

      <AuthModal />
      <ProfileAndAccountModal onOpenAdmin={() => setActiveView('admin')} />
      <ToastStack />
    </div>
  );
}

export default function App() {
  return (
    <PortalErrorBoundary>
      <AppProvider>
        <PortalContent />
      </AppProvider>
    </PortalErrorBoundary>
  );
}
