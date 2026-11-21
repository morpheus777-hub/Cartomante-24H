import React, { useEffect, useState } from 'react';
import { BellRing, Check, LogOut, Radio, Save, Upload, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SPIRITUAL_INTERESTS, ZODIAC_SIGNS } from '../data/zodiac';
import type { PublicUser } from '../types';

const PRESET_AVATARS = [
  '/src/assets/images/reader_selena_luna_1795241298228.jpg',
  '/src/assets/images/reader_orion_sol_1795241298267.jpg',
  '/src/assets/images/reader_maya_estrela_1795241298251.jpg',
  '/src/assets/images/tarot_deck_artwork_1795241297829.jpg',
  '/src/assets/images/hero_celestial_sanctuary_1795241298030.jpg',
];

export function ProfileAndAccountModal({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const {
    user,
    activeModal,
    setActiveModal,
    notifications,
    pushEnabled,
    enablePushNotifications,
    markNotificationsRead,
    apiFetch,
    refreshBootstrap,
    notifyToast,
    logout,
  } = useApp();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [zodiacSign, setZodiacSign] = useState('Peixes');
  const [ascendant, setAscendant] = useState('Libra');
  const [moonSign, setMoonSign] = useState('Câncer');
  const [interests, setInterests] = useState<string[]>([]);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [specialtiesText, setSpecialtiesText] = useState('');
  const [fullReadingPrice, setFullReadingPrice] = useState<number>(120);
  const [liveTitle, setLiveTitle] = useState('Tiragem Celestial Ao Vivo');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio);
      setAvatar(user.avatar);
      setZodiacSign(user.zodiacSign);
      setAscendant(user.ascendant);
      setMoonSign(user.moonSign);
      setInterests(user.interests || []);
      setWhatsappUrl(user.whatsappUrl || '');
      setSpecialtiesText((user.specialties || []).join(', '));
      setFullReadingPrice(user.fullReadingPrice || 120);
      setLiveTitle(user.liveTitle || 'Tiragem Celestial Ao Vivo');
    }
  }, [user, activeModal]);

  if (!user) return null;

  if (activeModal === 'notifications') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/45 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <div className="px-6 py-4 border-b border-[#EDE7F6] flex items-center justify-between bg-[#F7F3FC]">
            <div>
              <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">Notificações em Tempo Real</h3>
              <p className="text-xs text-[#6B5B8E]">Agendamentos confirmados, sugestões e matches astrais</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              aria-label="Fechar notificações"
              className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-3 border-b border-[#F1EAFD] bg-white flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={enablePushNotifications}
              className="px-3 py-1.5 rounded-lg bg-[#F3EEF9] hover:bg-[#E7DDF7] text-[#4C1D95] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>{pushEnabled ? 'Push no Navegador Ativo' : 'Ativar Alertas Push'}</span>
            </button>
            <button
              type="button"
              onClick={markNotificationsRead}
              className="text-xs font-semibold text-[#6D28D9] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Marcar todas como lidas</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F9F7FD]">
            {notifications.length === 0 ? (
              <p className="text-sm text-[#5E4E80] text-center py-6">Nenhuma notificação registrada até o momento.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border ${
                    n.read ? 'bg-white border-[#EDE7F6]' : 'bg-[#F3EEF9] border-[#D4C3F2]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#2E1A47]">{n.title}</p>
                    <span className="text-[11px] text-[#6B5B8E] tabular-nums">
                      {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-[#4B3A6B] mt-1 leading-relaxed">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeModal !== 'profile') return null;

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : prev.length < 6 ? [...prev, item] : prev
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 260_000) {
      notifyToast('Imagem muito grande', 'Escolha uma foto de até 250 KB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const specialties = specialtiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await apiFetch<{ user: PublicUser }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          bio,
          avatar,
          zodiacSign,
          ascendant,
          moonSign,
          interests,
          ...(user.role === 'cartomancer'
            ? {
                whatsappUrl,
                specialties,
                fullReadingPrice: Number(fullReadingPrice),
              }
            : {}),
        }),
      });
      await refreshBootstrap();
      notifyToast('Perfil atualizado', 'Suas alterações foram salvas com sucesso.', 'success');
      setActiveModal(null);
    } catch (err) {
      notifyToast('Erro ao salvar', err instanceof Error ? err.message : 'Verifique os campos.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLive = async () => {
    try {
      await apiFetch('/api/cartomancer/live', {
        method: 'POST',
        body: JSON.stringify({
          isLive: !user.isLive,
          liveTitle,
        }),
      });
      await refreshBootstrap();
      notifyToast(
        !user.isLive ? 'Transmissão Ao Vivo iniciada' : 'Transmissão encerrada',
        !user.isLive ? 'Os visitantes já podem assistir sua mesa ao vivo.' : undefined,
        'success'
      );
    } catch (err) {
      notifyToast('Erro na live', err instanceof Error ? err.message : 'Falha.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#EDE7F6] flex items-center justify-between bg-[#F7F3FC]">
          <div>
            <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
              Meu Perfil Celestial
            </h3>
            <p className="text-xs text-[#6B5B8E]">
              {user.email} · {user.role === 'cartomancer' ? 'Cartomante' : user.role === 'admin' ? 'Administrador' : user.role === 'subadmin' ? user.roleLabel || 'Subconta' : 'Consulente'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal(null)}
            aria-label="Fechar perfil"
            className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveProfile} className="p-6 space-y-5 overflow-y-auto">
          {/* Avatar Selection + Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <img
              src={avatar}
              alt={name}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-full object-cover border-2 border-[#6D28D9]/40 shrink-0"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg bg-[#F3EEF9] hover:bg-[#E7DDF7] text-[#4C1D95] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Enviar Foto</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoUpload} className="hidden" />
                </label>
                {PRESET_AVATARS.map((imgUrl, idx) => (
                  <button
                    key={imgUrl}
                    type="button"
                    onClick={() => setAvatar(imgUrl)}
                    className={`w-8 h-8 rounded-full overflow-hidden border-2 cursor-pointer ${
                      avatar === imgUrl ? 'border-[#6D28D9]' : 'border-transparent'
                    }`}
                  >
                    <img src={imgUrl} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#6B5B8E]">Escolha um retrato celestial ou envie sua própria foto (até 250 KB).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Nome de Exibição</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Signo Solar</label>
              <select
                value={zodiacSign}
                onChange={(e) => setZodiacSign(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] bg-white text-sm"
              >
                {ZODIAC_SIGNS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.symbol} {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Ascendente</label>
              <select
                value={ascendant}
                onChange={(e) => setAscendant(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] bg-white text-sm"
              >
                {ZODIAC_SIGNS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Signo Lunar</label>
              <select
                value={moonSign}
                onChange={(e) => setMoonSign(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] bg-white text-sm"
              >
                {ZODIAC_SIGNS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Biografia Pessoal</label>
            <textarea
              rows={3}
              maxLength={420}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4B3A6B] mb-2">
              Interesses Astrológicos & Espirituais (para Match Astral)
            </label>
            <div className="flex flex-wrap gap-2">
              {SPIRITUAL_INTERESTS.map((item) => {
                const selected = interests.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInterest(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                        : 'bg-white text-[#524373] border-[#DCD1EF] hover:bg-[#F3EEF9]'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {user.role === 'cartomancer' && (
            <div className="p-4 rounded-xl bg-[#F7F3FC] border border-[#DFD4F2] space-y-4">
              <h4 className="font-display text-xl font-semibold text-[#2E1A47]">
                Área Exclusiva da Cartomante · Vídeo Live & Tabela
              </h4>
              <div className="p-3 rounded-lg bg-white border border-[#E6DDF5] flex items-center justify-between text-xs text-[#4B3A6B] tabular-nums">
                <span>1 Pergunta: <strong className="text-[#6D28D9]">R$ 15,00</strong></span>
                <span>·</span>
                <span>3 Perguntas: <strong className="text-[#6D28D9]">R$ 50,00</strong></span>
                <span>·</span>
                <span>Jogo Completo: <strong className="text-[#B45309]">R$ {fullReadingPrice},00</strong></span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                    WhatsApp Atendimento Direto
                  </label>
                  <input
                    type="url"
                    value={whatsappUrl}
                    onChange={(e) => setWhatsappUrl(e.target.value)}
                    placeholder="https://wa.me/5511999999999"
                    className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                    Valor Jogo Completo (R$) · Status: {user.fullReadingStatus === 'approved' ? 'Aprovado' : 'Aguardando Admin'}
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={2000}
                    value={fullReadingPrice}
                    onChange={(e) => setFullReadingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] bg-white text-xs tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">
                  Especialidades (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={specialtiesText}
                  onChange={(e) => setSpecialtiesText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] bg-white text-xs"
                />
              </div>

              <div className="pt-2 border-t border-[#E6DDF5] flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="text"
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="Título da sua live"
                  className="flex-1 px-3 py-2 rounded-lg border border-[#DCD1EF] bg-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleToggleLive}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    user.isLive
                      ? 'bg-rose-700 hover:bg-rose-800 text-white'
                      : 'bg-[#BE185D] hover:bg-[#9D174D] text-white'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{user.isLive ? 'Encerrar Live' : 'Ativar Sala Ao Vivo'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#EDE7F6]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setActiveModal(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-xs font-semibold text-[#524373] hover:bg-rose-50 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>

              {(user.role === 'admin' || user.role === 'subadmin') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onOpenAdmin();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#F3EEF9] text-[#4C1D95] text-xs font-semibold cursor-pointer"
                >
                  Ir ao Painel Admin
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Perfil'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
