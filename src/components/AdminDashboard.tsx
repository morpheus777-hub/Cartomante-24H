import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  DollarSign,
  Image,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UploaderWidget } from './UploaderWidget';
import type { AdminPermission, Consultation, OnlineSession, PresenceLog, PublicUser, UploadedAsset } from '../types';

const PERMISSION_LABELS: Record<AdminPermission, string> = {
  view_online: 'Ver usuários online e entradas/saídas',
  view_reports: 'Ver relatórios financeiros',
  approve_prices: 'Aprovar valores de Jogo Completo',
  manage_consultations: 'Editar cartomantes e consultas',
  moderate_community: 'Moderar publicações da comunidade',
  manage_users: 'Gerenciar subcontas da equipe',
};

export function AdminDashboard({ onBackToPortal }: { onBackToPortal: () => void }) {
  const { user, apiFetch, notifyToast, refreshBootstrap } = useApp();
  const [onlineSessions, setOnlineSessions] = useState<OnlineSession[]>([]);
  const [presenceLogs, setPresenceLogs] = useState<PresenceLog[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [cartomancers, setCartomancers] = useState<PublicUser[]>([]);
  const [subaccounts, setSubaccounts] = useState<PublicUser[]>([]);
  const [uploads, setUploads] = useState<UploadedAsset[]>([]);
  const [lastUploadedUrl, setLastUploadedUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Quick edit modal state
  const [editingReader, setEditingReader] = useState<PublicUser | null>(null);
  const [editBio, setEditBio] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editPrice, setEditPrice] = useState(120);

  // New subaccount form
  const [subName, setSubName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subPassword, setSubPassword] = useState('');
  const [subRoleLabel, setSubRoleLabel] = useState('Curadoria & Suporte');
  const [subPerms, setSubPerms] = useState<AdminPermission[]>(['view_online', 'approve_prices']);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [data, uploadsData] = await Promise.all([
        apiFetch<{
          onlineSessions: OnlineSession[];
          presenceLogs: PresenceLog[];
          consultations: Consultation[];
          totalRevenue: number;
          cartomancers: PublicUser[];
          subaccounts: PublicUser[];
        }>('/api/admin/overview'),
        apiFetch<{ uploads: UploadedAsset[] }>('/api/uploads').catch(() => ({ uploads: [] })),
      ]);
      setOnlineSessions(data.onlineSessions);
      setPresenceLogs(data.presenceLogs);
      setConsultations(data.consultations);
      setTotalRevenue(data.totalRevenue);
      setCartomancers(data.cartomancers);
      setSubaccounts(data.subaccounts);
      setUploads(uploadsData.uploads);
    } catch (err) {
      notifyToast('Erro no painel', err instanceof Error ? err.message : 'Sem permissão.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, notifyToast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handlePriceApproval = async (cartomancerId: string, status: 'approved' | 'rejected') => {
    try {
      await apiFetch('/api/admin/price-approval', {
        method: 'POST',
        body: JSON.stringify({ cartomancerId, status }),
      });
      await loadOverview();
      await refreshBootstrap();
      notifyToast(status === 'approved' ? 'Valor aprovado' : 'Valor devolvido para revisão', undefined, 'success');
    } catch (err) {
      notifyToast('Erro', err instanceof Error ? err.message : 'Falha na aprovação.', 'error');
    }
  };

  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReader) return;
    try {
      await apiFetch(`/api/admin/cartomancer/${editingReader.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          bio: editBio,
          whatsappUrl: editWhatsapp,
          fullReadingPrice: Number(editPrice),
        }),
      });
      setEditingReader(null);
      await loadOverview();
      await refreshBootstrap();
      notifyToast('Cartomante atualizado', undefined, 'success');
    } catch (err) {
      notifyToast('Erro ao editar', err instanceof Error ? err.message : 'Verifique os dados.', 'error');
    }
  };

  const handleCreateSubaccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/subaccounts', {
        method: 'POST',
        body: JSON.stringify({
          name: subName,
          email: subEmail,
          password: subPassword,
          roleLabel: subRoleLabel,
          permissions: subPerms,
        }),
      });
      setSubName('');
      setSubEmail('');
      setSubPassword('');
      await loadOverview();
      notifyToast('Subconta criada', 'Permissões personalizadas aplicadas com sucesso.', 'success');
    } catch (err) {
      notifyToast('Erro ao criar subconta', err instanceof Error ? err.message : 'Falha.', 'error');
    }
  };

  const handleDeleteSubaccount = async (id: string) => {
    try {
      await apiFetch(`/api/admin/subaccounts/${id}`, { method: 'DELETE' });
      await loadOverview();
      notifyToast('Subconta removida', undefined, 'info');
    } catch (err) {
      notifyToast('Erro', err instanceof Error ? err.message : 'Falha.', 'error');
    }
  };

  const toggleSubPerm = (perm: AdminPermission) => {
    setSubPerms((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const handleDeleteUpload = async (id: string) => {
    try {
      await apiFetch(`/api/uploads/${id}`, { method: 'DELETE' });
      setUploads((prev) => prev.filter((u) => u.id !== id));
      notifyToast('Arquivo excluído do Upador', undefined, 'info');
    } catch (err) {
      notifyToast('Erro ao excluir', err instanceof Error ? err.message : 'Sem permissão.', 'error');
    }
  };

  const handleCopyAssetLink = async (url: string) => {
    const full = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(full);
      notifyToast('Link copiado', 'URL pronta para uso no portal.', 'success');
    } catch {
      notifyToast('Falha ao copiar', 'Copie manualmente o endereço.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7FD] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6DDF5]">
          <div>
            <button
              type="button"
              onClick={onBackToPortal}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6D28D9] hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Portal Público</span>
            </button>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#2E1A47]">
              Painel Administrativo & Subcontas
            </h1>
            <p className="text-xs text-[#6B5B8E] mt-1">
              Sessão ativa: {user?.name} ({user?.role === 'admin' ? 'Administrador Geral' : user?.roleLabel || 'Subconta'})
            </p>
          </div>

          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-white border border-[#DCD1EF] hover:bg-[#F3EEF9] text-xs font-semibold text-[#2E1A47] inline-flex items-center gap-2 self-start cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Dados</span>
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white border border-[#E6DDF5]">
            <p className="text-xs text-[#6B5B8E]">Usuários Online Agora</p>
            <p className="font-mono text-2xl font-semibold text-[#2E1A47] mt-1 tabular-nums">{onlineSessions.length}</p>
          </div>
          <div className="p-5 rounded-xl bg-white border border-[#E6DDF5]">
            <p className="text-xs text-[#6B5B8E]">Receita Total Confirmada</p>
            <p className="font-mono text-2xl font-semibold text-[#6D28D9] mt-1 tabular-nums">
              R$ {totalRevenue.toFixed(2).replace('.', ',')}
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white border border-[#E6DDF5]">
            <p className="text-xs text-[#6B5B8E]">Consultas Registradas</p>
            <p className="font-mono text-2xl font-semibold text-[#2E1A47] mt-1 tabular-nums">{consultations.length}</p>
          </div>
          <div className="p-5 rounded-xl bg-white border border-[#E6DDF5]">
            <p className="text-xs text-[#6B5B8E]">Registros Entrada/Saída</p>
            <p className="font-mono text-2xl font-semibold text-[#2E1A47] mt-1 tabular-nums">{presenceLogs.length}</p>
          </div>
        </div>

        {/* Online Now & Entry/Exit Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
                Quem Está Online Agora
              </h2>
              <Activity className="w-5 h-5 text-[#6D28D9]" />
            </div>
            {onlineSessions.length === 0 ? (
              <p className="text-xs text-[#6B5B8E]">Nenhum usuário autenticado conectado no WebSocket agora.</p>
            ) : (
              <div className="divide-y divide-[#F1EAFD]">
                {onlineSessions.map((s) => (
                  <div key={s.userId} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#2E1A47] truncate">{s.userName}</p>
                      <p className="text-xs text-[#6B5B8E] truncate">
                        {s.userEmail} · {s.role}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-[#6D28D9]">{s.activeSection}</p>
                      <p className="font-mono text-[11px] text-[#6B5B8E] tabular-nums">
                        {new Date(s.connectedAt).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
                Banco de Entradas e Saídas
              </h2>
              <Users className="w-5 h-5 text-[#6D28D9]" />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-[#F1EAFD]">
              {presenceLogs.length === 0 ? (
                <p className="text-xs text-[#6B5B8E]">Ainda sem eventos registrados.</p>
              ) : (
                presenceLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#2E1A47] truncate">
                        {log.action === 'enter' ? 'Entrada' : 'Saída'} · {log.userName}
                      </p>
                      <p className="text-[#6B5B8E] truncate">
                        {log.userEmail} · {log.deviceInfo}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-[#524373] tabular-nums shrink-0">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cartomancer Price Approvals & Quick Edit */}
        <div className="p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
                Aprovação de Valores (Jogo Completo) & Edição Rápida
              </h2>
              <p className="text-xs text-[#6B5B8E]">
                Aprove os valores submetidos pelas cartomantes ou edite rapidamente seus perfis.
              </p>
            </div>
            <DollarSign className="w-5 h-5 text-[#B45309]" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EDE7F6] text-[#6B5B8E]">
                <tr>
                  <th className="py-2.5 pr-4">Cartomante</th>
                  <th className="py-2.5 pr-4">Jogo Completo</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Leituras</th>
                  <th className="py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EAFD]">
                {cartomancers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4 font-semibold text-[#2E1A47]">{c.name}</td>
                    <td className="py-3 pr-4 font-mono tabular-nums">
                      R$ {(c.fullReadingPrice || 0).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-3 pr-4">
                      {c.fullReadingStatus === 'approved'
                        ? 'Aprovado'
                        : c.fullReadingStatus === 'pending'
                        ? 'Pendente de aprovação'
                        : 'Revisão solicitada'}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums">{c.totalReadings || 0}</td>
                    <td className="py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handlePriceApproval(c.id, 'approved')}
                        className="px-2.5 py-1 rounded bg-emerald-700 text-white font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Aprovar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePriceApproval(c.id, 'rejected')}
                        className="px-2.5 py-1 rounded border border-[#DCD1EF] text-[#524373] font-semibold cursor-pointer"
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReader(c);
                          setEditBio(c.bio);
                          setEditWhatsapp(c.whatsappUrl || '');
                          setEditPrice(c.fullReadingPrice || 120);
                        }}
                        className="px-2.5 py-1 rounded bg-[#F3EEF9] text-[#4C1D95] font-semibold cursor-pointer"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Earnings & Consultations Report */}
        <div className="p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
            Relatório Financeiro e Consultas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EDE7F6] text-[#6B5B8E]">
                <tr>
                  <th className="py-2.5 pr-4">Consulente</th>
                  <th className="py-2.5 pr-4">Cartomante</th>
                  <th className="py-2.5 pr-4">Modalidade</th>
                  <th className="py-2.5 pr-4">Pagamento</th>
                  <th className="py-2.5 pr-4 text-right">Valor</th>
                  <th className="py-2.5 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EAFD]">
                {consultations.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 font-semibold text-[#2E1A47]">{c.userName}</td>
                    <td className="py-2.5 pr-4 text-[#4B3A6B]">{c.cartomancerName}</td>
                    <td className="py-2.5 pr-4">
                      {c.tier === 'one_question'
                        ? '1 Pergunta'
                        : c.tier === 'three_questions'
                        ? '3 Perguntas'
                        : 'Jogo Completo'}
                    </td>
                    <td className="py-2.5 pr-4 uppercase">{c.paymentMethod}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums font-semibold text-[#6D28D9]">
                      R$ {c.price.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-[#6B5B8E]">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subaccounts & Custom Permissions */}
        {(user?.role === 'admin' || user?.permissions.includes('manage_users')) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form onSubmit={handleCreateSubaccount} className="lg:col-span-5 p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#6D28D9]" />
                <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
                  Criar Subconta da Equipe
                </h2>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                />
                <input
                  type="email"
                  required
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="E-mail da subconta"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={subPassword}
                  onChange={(e) => setSubPassword(e.target.value)}
                  placeholder="Senha inicial (mínimo 6 caracteres)"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                />
                <input
                  type="text"
                  value={subRoleLabel}
                  onChange={(e) => setSubRoleLabel(e.target.value)}
                  placeholder="Cargo / Função (ex.: Financeiro)"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                />
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-[#4B3A6B]">Permissões Personalizadas</p>
                {(Object.keys(PERMISSION_LABELS) as AdminPermission[]).map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-xs text-[#2E1A47] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subPerms.includes(perm)}
                      onChange={() => toggleSubPerm(perm)}
                      className="rounded border-[#DCD1EF] text-[#6D28D9]"
                    />
                    <span>{PERMISSION_LABELS[perm]}</span>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Subconta</span>
              </button>
            </form>

            <div className="lg:col-span-7 p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
                Subcontas Ativas ({subaccounts.length})
              </h2>
              {subaccounts.length === 0 ? (
                <p className="text-xs text-[#6B5B8E]">Nenhuma subconta criada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {subaccounts.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-xl bg-[#F9F7FD] border border-[#EDE7F6] flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#2E1A47]">
                          {sub.name} · <span className="text-[#6D28D9]">{sub.roleLabel}</span>
                        </p>
                        <p className="text-xs text-[#6B5B8E]">{sub.email}</p>
                        <p className="text-[11px] text-[#524373] mt-1.5">
                          Permissões: {sub.permissions.map((p) => PERMISSION_LABELS[p]).join(' · ') || 'Nenhuma'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubaccount(sub.id)}
                        aria-label="Remover subconta"
                        className="p-2 rounded-lg text-[#7C6B9E] hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upador de Mídia & Galeria */}
        <div className="p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#2E1A47]">
                Upador de Imagens & Galeria de Mídia
              </h2>
              <p className="text-xs text-[#6B5B8E]">
                Envie artes, fotos de cartas e banners para gerar links diretos no portal ({uploads.length} arquivos).
              </p>
            </div>
            <Image className="w-5 h-5 text-[#6D28D9]" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4">
              <UploaderWidget
                label="Novo Envio no Upador"
                helperText="PNG, JPG ou WEBP de até 2 MB."
                value={lastUploadedUrl}
                onUploaded={(asset) => {
                  setLastUploadedUrl(asset.url);
                  setUploads((prev) => [asset, ...prev]);
                }}
                onClear={() => setLastUploadedUrl('')}
              />
            </div>

            <div className="lg:col-span-8">
              {uploads.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#F9F7FD] border border-[#EDE7F6] text-xs text-[#6B5B8E] text-center">
                  Nenhuma imagem enviada ainda pelo Upador.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                  {uploads.map((asset) => (
                    <div
                      key={asset.id}
                      className="rounded-xl border border-[#E6DDF5] bg-[#F9F7FD] overflow-hidden flex flex-col justify-between"
                    >
                      <div className="h-32 bg-[#EFE8FB] overflow-hidden">
                        <img
                          src={asset.url}
                          alt={asset.originalName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3 space-y-2">
                        <div>
                          <p className="text-xs font-semibold text-[#2E1A47] truncate">{asset.originalName}</p>
                          <p className="text-[11px] text-[#6B5B8E] truncate tabular-nums">
                            {asset.userName} · {Math.max(1, Math.round(asset.sizeBytes / 1024))} KB
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#EDE7F6]">
                          <button
                            type="button"
                            onClick={() => handleCopyAssetLink(asset.url)}
                            className="px-2.5 py-1 rounded bg-white border border-[#DCD1EF] hover:bg-[#F3EEF9] text-[#4C1D95] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar Link</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUpload(asset.id)}
                            aria-label="Excluir arquivo"
                            className="p-1.5 rounded text-[#7C6B9E] hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Edit Cartomancer Modal */}
      {editingReader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1633]/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FDFBFF] border border-[#DFD4F2] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EDE7F6] flex items-center justify-between bg-[#F7F3FC]">
              <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
                Editar {editingReader.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingReader(null)}
                className="p-2 rounded-lg text-[#524373] hover:bg-[#EDE7F6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Biografia</label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Link WhatsApp</label>
                <input
                  type="url"
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Valor Jogo Completo (R$)</label>
                <input
                  type="number"
                  min={60}
                  max={2000}
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[#DCD1EF] text-xs tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#6D28D9] text-white text-xs font-semibold cursor-pointer"
              >
                Salvar e Aprovar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
