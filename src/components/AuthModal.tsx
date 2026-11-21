import React, { useEffect, useState } from 'react';
import { ShieldCheck, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZODIAC_SIGNS } from '../data/zodiac';
import type { PublicUser } from '../types';

export function AuthModal() {
  const { activeModal, setActiveModal, setSession, notifyToast, apiFetch } = useApp();
  const [tab, setTab] = useState<'login' | 'register' | 'admin'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'user' | 'cartomancer'>('user');
  const [zodiacSign, setZodiacSign] = useState('Peixes');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminStatus, setAdminStatus] = useState<{ adminClaimed: boolean; passcodeConfigured: boolean }>({
    adminClaimed: false,
    passcodeConfigured: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeModal === 'auth') {
      apiFetch<{ adminClaimed: boolean; passcodeConfigured: boolean }>('/api/auth/status')
        .then(setAdminStatus)
        .catch(() => {});
    }
  }, [activeModal, apiFetch]);

  if (activeModal !== 'auth') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'login') {
        const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setSession(res.token, res.user);
        setActiveModal(null);
        notifyToast('Entrada registrada', `Bem-vindo(a) ao Cartomantes 24h, ${res.user.name}.`, 'success');
      } else if (tab === 'register') {
        const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, name, password, accountType, zodiacSign, whatsappUrl }),
        });
        setSession(res.token, res.user);
        setActiveModal(null);
        notifyToast('Conta celestial criada', 'Seu histórico de leituras e perfil já estão ativos.', 'success');
      } else {
        const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/claim-admin', {
          method: 'POST',
          body: JSON.stringify({ email, name, password, passcode: adminPasscode }),
        });
        setSession(res.token, res.user);
        setActiveModal(null);
        notifyToast('Administrador configurado', 'Painel administrativo e subcontas liberados.', 'success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#EDE7F6] flex items-center justify-between bg-[#F7F3FC]">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
              Portal Cartomantes 24h
            </h2>
            <p className="text-xs text-[#6B5B8E] mt-0.5">
              Entre com seu Gmail ou e-mail para salvar leituras, chats e conexões.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal(null)}
            aria-label="Fechar janela de entrada"
            className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-1 p-1 bg-[#F1EAFD] rounded-lg mb-5">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError('');
              }}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'login' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80] hover:text-[#2E1A47]'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError('');
              }}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'register' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80] hover:text-[#2E1A47]'
              }`}
            >
              Criar Conta
            </button>
            {(!adminStatus.adminClaimed || adminStatus.passcodeConfigured) && (
              <button
                type="button"
                onClick={() => {
                  setTab('admin');
                  setError('');
                }}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'admin' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-[#5E4E80] hover:text-[#2E1A47]'
                }`}
              >
                Admin Inicial
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab !== 'login' && (
              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome espiritual ou civil"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                E-mail ou Gmail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seunome@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                Senha de Acesso
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
              />
            </div>

            {tab === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                      Tipo de Perfil
                    </label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as 'user' | 'cartomancer')}
                      className="w-full px-3 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                    >
                      <option value="user">Consulente</option>
                      <option value="cartomancer">Cartomante</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                      Signo Solar
                    </label>
                    <select
                      value={zodiacSign}
                      onChange={(e) => setZodiacSign(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                    >
                      {ZODIAC_SIGNS.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.symbol} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {accountType === 'cartomancer' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                      Link Direto do WhatsApp (Atendimento Automatizado)
                    </label>
                    <input
                      type="url"
                      value={whatsappUrl}
                      onChange={(e) => setWhatsappUrl(e.target.value)}
                      placeholder="https://wa.me/5511999999999"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                    />
                  </div>
                )}
              </>
            )}

            {tab === 'admin' && adminStatus.passcodeConfigured && (
              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                  Código de Administrador
                </label>
                <input
                  type="password"
                  required
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder="Informe o código de configuração"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/30"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {tab === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              <span>
                {submitting
                  ? 'Autenticando...'
                  : tab === 'login'
                  ? 'Entrar no Portal'
                  : tab === 'register'
                  ? 'Criar Conta Celestial'
                  : 'Ativar Conta Administradora'}
              </span>
            </button>
          </form>

          <p className="mt-4 text-[11px] leading-relaxed text-[#6B5B8E] text-center">
            Seu registro de entrada e saída fica protegido no banco de dados do portal para segurança das consultas em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
