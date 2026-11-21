import React, { useState } from 'react';
import { Heart, MessageSquare, Send, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZODIAC_SIGNS } from '../data/zodiac';
import { UploaderWidget } from './UploaderWidget';

export function CommunitySection() {
  const { user, communityPosts, setActiveModal, notifyToast, apiFetch } = useApp();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('Experiência de Leitura');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);

  const userSignInfo = ZODIAC_SIGNS.find((s) => s.name === (user?.zodiacSign || 'Peixes')) || ZODIAC_SIGNS[11];

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setActiveModal('auth');
      return;
    }
    setPosting(true);
    try {
      await apiFetch('/api/community/posts', {
        method: 'POST',
        body: JSON.stringify({ title, content, category, ...(imageUrl ? { imageUrl } : {}) }),
      });
      setTitle('');
      setContent('');
      setImageUrl('');
      notifyToast('Publicado na comunidade', 'Sua reflexão celestial já está visível para os membros.', 'success');
    } catch (err) {
      notifyToast('Erro ao publicar', err instanceof Error ? err.message : 'Tente novamente.', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      setActiveModal('auth');
      return;
    }
    try {
      await apiFetch(`/api/community/posts/${postId}/like`, { method: 'POST' });
    } catch (err) {
      notifyToast('Erro', err instanceof Error ? err.message : 'Falha ao curtir.', 'error');
    }
  };

  const handleComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!user) {
      setActiveModal('auth');
      return;
    }
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    try {
      await apiFetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      notifyToast('Erro ao comentar', err instanceof Error ? err.message : 'Tente novamente.', 'error');
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await apiFetch(`/api/community/posts/${postId}`, { method: 'DELETE' });
      notifyToast('Publicação removida', undefined, 'info');
    } catch (err) {
      notifyToast('Erro ao remover', err instanceof Error ? err.message : 'Sem permissão.', 'error');
    }
  };

  return (
    <section id="comunidade" className="py-16 border-t border-[#E6DDF5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#6D28D9] mb-2">
              Comunidade Celestial
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#2E1A47] text-balance">
              Previsões diárias, rituais e troca de experiências
            </h2>
            <p className="text-sm sm:text-base text-[#5E4E80] mt-2 leading-relaxed">
              Curta e comente as orientações publicadas pelas cartomantes ou compartilhe como sua última tiragem iluminou seu caminho.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F3EEF9] border border-[#DFD4F2] max-w-md">
            <p className="text-xs font-semibold text-[#6D28D9]">
              Sugestão Personalizada · {userSignInfo.symbol} {userSignInfo.name}
            </p>
            <p className="text-xs text-[#3D2C5E] mt-1 leading-relaxed">{userSignInfo.dailyEnergy}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Publish Post Form */}
          <div className="lg:col-span-4">
            <form onSubmit={handlePublish} className="p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#2E1A47]">
                Compartilhar na Comunidade
              </h3>
              <p className="text-xs text-[#6B5B8E]">
                {user?.role === 'cartomancer'
                  ? 'Como cartomante, sua publicação envia alertas em tempo real para os membros.'
                  : 'Conte sua experiência com as leituras ou deixe uma reflexão espiritual.'}
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#DCD1EF] bg-white text-sm text-[#1E1633]"
                >
                  <option value="Previsão Diária">Previsão Diária</option>
                  <option value="Experiência de Leitura">Experiência de Leitura</option>
                  <option value="Astrologia">Astrologia</option>
                  <option value="Rituais & Cristais">Rituais & Cristais</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Título</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: A carta A Estrela confirmou meu ciclo"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B3A6B] mb-1">Mensagem</label>
                <textarea
                  required
                  rows={4}
                  maxLength={1200}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva sua previsão ou relato para os membros..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD1EF] text-sm"
                />
              </div>

              <UploaderWidget
                compact
                label="Anexar Foto ou Tiragem (Opcional)"
                helperText="Envie foto das cartas ou ritual (PNG, JPG ou WEBP até 2 MB)."
                value={imageUrl}
                onUploaded={(asset) => setImageUrl(asset.url)}
                onClear={() => setImageUrl('')}
              />

              <button
                type="submit"
                disabled={posting}
                className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{posting ? 'Publicando...' : user ? 'Publicar Reflexão' : 'Entrar para Publicar'}</span>
              </button>
            </form>
          </div>

          {/* Feed */}
          <div className="lg:col-span-8 space-y-5">
            {communityPosts.map((post) => {
              const liked = user ? post.likes.includes(user.id) : false;
              const canDelete =
                user && (post.authorId === user.id || user.role === 'admin' || user.permissions.includes('moderate_community'));

              return (
                <article key={post.id} className="p-6 rounded-2xl bg-white border border-[#E6DDF5] space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.authorAvatar}
                        alt={post.authorName}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover border border-[#DFD4F2]"
                      />
                      <div>
                        <h3 className="text-sm font-semibold text-[#2E1A47]">{post.authorName}</h3>
                        <p className="text-xs text-[#6B5B8E]">
                          {post.authorRole === 'cartomancer' ? 'Cartomante' : 'Membro'} · {post.authorSign} · {post.category} ·{' '}
                          {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        aria-label="Excluir publicação"
                        className="p-2 rounded-lg text-[#7C6B9E] hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 className="font-display text-2xl font-semibold text-[#2E1A47]">{post.title}</h4>
                    <p className="text-sm text-[#4B3A6B] mt-2 leading-relaxed whitespace-pre-line">{post.content}</p>
                    {post.imageUrl && (
                      <div className="mt-4 rounded-xl overflow-hidden border border-[#E6DDF5] bg-[#F9F7FD]">
                        <img
                          src={post.imageUrl}
                          alt={`Imagem da publicação: ${post.title}`}
                          referrerPolicy="no-referrer"
                          className="w-full max-h-96 object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#F1EAFD] flex items-center gap-6 text-xs font-semibold text-[#5E4E80]">
                    <button
                      type="button"
                      onClick={() => handleLike(post.id)}
                      className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        liked ? 'text-[#BE185D]' : 'hover:text-[#BE185D]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                      <span className="tabular-nums">{post.likes.length} Curtidas</span>
                    </button>

                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      <span className="tabular-nums">{post.comments.length} Comentários</span>
                    </span>
                  </div>

                  {post.comments.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      {post.comments.map((c) => (
                        <div key={c.id} className="p-3 rounded-xl bg-[#F9F7FD] border border-[#EDE7F6] flex items-start gap-2.5">
                          <img
                            src={c.userAvatar}
                            alt={c.userName}
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full object-cover mt-0.5"
                          />
                          <div>
                            <p className="text-xs font-semibold text-[#2E1A47]">{c.userName}</p>
                            <p className="text-xs text-[#4B3A6B] mt-0.5 leading-relaxed">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={(e) => handleComment(e, post.id)} className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      maxLength={450}
                      value={commentDrafts[post.id] || ''}
                      onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder={user ? 'Escreva um comentário...' : 'Entre para comentar esta leitura'}
                      className="flex-1 px-3.5 py-2 rounded-lg border border-[#DCD1EF] text-xs"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-lg bg-[#F3EEF9] hover:bg-[#E7DDF7] text-[#4C1D95] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Comentar</span>
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
