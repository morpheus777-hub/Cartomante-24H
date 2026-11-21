import { useState } from 'react';
import { Bell, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  activeView: 'portal' | 'admin';
  onSelectView: (view: 'portal' | 'admin', sectionId?: string) => void;
}

export function Header({ activeView, onSelectView }: HeaderProps) {
  const { user, notifications, setActiveModal, sendWsSection } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const canOpenAdmin = user && (user.role === 'admin' || user.role === 'subadmin');

  const handleNavClick = (sectionId: string, label: string) => {
    setMobileMenuOpen(false);
    sendWsSection(label);
    onSelectView('portal', sectionId);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FDFBFF]/92 backdrop-blur-md border-b border-[#E6DDF5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single text element) */}
        <a
          href="#inicio"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('inicio', 'Início');
          }}
          className="font-display text-2xl font-semibold tracking-tight text-[#2E1A47] whitespace-nowrap shrink-0"
        >
          Cartomantes 24h
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#524373]">
          <a
            href="#cartomantes"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('cartomantes', 'Cartomantes');
            }}
            className="hover:text-[#6D28D9] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Cartomantes
          </a>
          <a
            href="#oraculo"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('oraculo', 'Tarot & Leituras');
            }}
            className="hover:text-[#6D28D9] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Tarot & Leituras
          </a>
          <a
            href="#comunidade"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('comunidade', 'Comunidade');
            }}
            className="hover:text-[#6D28D9] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Comunidade
          </a>
          <a
            href="#match-astral"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('match-astral', 'Match Astral');
            }}
            className="hover:text-[#6D28D9] transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Match Astral
          </a>
          {canOpenAdmin ? (
            <button
              type="button"
              onClick={() => {
                sendWsSection('Painel Administrativo');
                onSelectView(activeView === 'admin' ? 'portal' : 'admin');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                activeView === 'admin'
                  ? 'text-[#6D28D9] font-semibold underline underline-offset-4'
                  : 'hover:text-[#6D28D9]'
              }`}
            >
              Painel Admin
            </button>
          ) : (
            <a
              href="#planos"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('planos', 'Valores');
              }}
              className="hover:text-[#6D28D9] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Valores
            </a>
          )}
        </nav>

        {/* Zone 3: 1 Primary Action + mobile menu toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <button
              type="button"
              onClick={() => setActiveModal('notifications')}
              aria-label="Abrir notificações"
              className="relative p-2 rounded-lg text-[#524373] hover:bg-[#F1EAFD] transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#BE185D] text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {user ? (
            <button
              type="button"
              onClick={() => setActiveModal('profile')}
              className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer max-w-[170px] truncate"
            >
              {user.name.split(' ')[0]} · Perfil
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveModal('auth')}
              className="px-5 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Entrar
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menu de navegação"
            className="lg:hidden p-2 rounded-lg text-[#2E1A47] hover:bg-[#F1EAFD] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E6DDF5] bg-[#FDFBFF] px-4 py-3 flex flex-col gap-2 text-sm font-medium text-[#3D2C5E]">
          <button
            type="button"
            onClick={() => handleNavClick('cartomantes', 'Cartomantes')}
            className="text-left py-2.5 px-3 rounded-lg hover:bg-[#F3EEF9]"
          >
            Cartomantes ao Vivo
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('oraculo', 'Tarot & Leituras')}
            className="text-left py-2.5 px-3 rounded-lg hover:bg-[#F3EEF9]"
          >
            Tarot & Histórico de Leituras
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('comunidade', 'Comunidade')}
            className="text-left py-2.5 px-3 rounded-lg hover:bg-[#F3EEF9]"
          >
            Comunidade Celestial
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('match-astral', 'Match Astral')}
            className="text-left py-2.5 px-3 rounded-lg hover:bg-[#F3EEF9]"
          >
            Match Astral & Chat Privado
          </button>
          {canOpenAdmin && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onSelectView(activeView === 'admin' ? 'portal' : 'admin');
              }}
              className="text-left py-2.5 px-3 rounded-lg bg-[#F3EEF9] text-[#6D28D9] font-semibold"
            >
              {activeView === 'admin' ? 'Voltar ao Portal' : 'Abrir Painel Admin'}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
