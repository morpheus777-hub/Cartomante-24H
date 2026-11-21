import React, { useRef, useState } from 'react';
import { Check, Copy, ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { UploadedAsset } from '../types';

interface UploaderWidgetProps {
  value?: string;
  onUploaded: (asset: UploadedAsset) => void;
  onClear?: () => void;
  label?: string;
  helperText?: string;
  compact?: boolean;
}

export function UploaderWidget({
  value,
  onUploaded,
  onClear,
  label = 'Upador de Imagens',
  helperText = 'PNG, JPG ou WEBP de até 2 MB.',
  compact = false,
}: UploaderWidgetProps) {
  const { user, setActiveModal, apiFetch, notifyToast } = useApp();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const processFile = async (file: File) => {
    if (!user) {
      setActiveModal('auth');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      notifyToast('Formato não suportado', 'Envie apenas imagens PNG, JPG ou WEBP.', 'error');
      return;
    }

    if (file.size > 2_000_000) {
      notifyToast('Arquivo acima do limite', 'A imagem deve ter no máximo 2 MB.', 'error');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Não foi possível ler a imagem.'));
          }
        };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo selecionado.'));
        reader.readAsDataURL(file);
      });

      const res = await apiFetch<{ asset: UploadedAsset }>('/api/uploads', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl,
          originalName: file.name,
        }),
      });

      onUploaded(res.asset);
      notifyToast('Imagem enviada', 'Arquivo salvo com sucesso no Upador.', 'success');
    } catch (err) {
      notifyToast('Erro no envio', err instanceof Error ? err.message : 'Falha ao enviar imagem.', 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleCopyUrl = async () => {
    if (!value) return;
    const fullUrl = value.startsWith('http') ? value : `${window.location.origin}${value}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      notifyToast('Link copiado', 'Endereço da imagem pronto para colar.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyToast('Não foi possível copiar', 'Copie manualmente o endereço exibido.', 'error');
    }
  };

  return (
    <div className="space-y-2.5">
      {label && <label className="block text-xs font-semibold text-[#4B3A6B]">{label}</label>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="rounded-xl border border-[#DFD4F2] bg-[#F9F7FD] p-3 space-y-2.5">
          <div className="relative rounded-lg overflow-hidden bg-[#EFE8FB] border border-[#E6DDF5]">
            <img
              src={value}
              alt="Pré-visualização da imagem enviada"
              referrerPolicy="no-referrer"
              className={`w-full object-cover ${compact ? 'max-h-40' : 'max-h-56'}`}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#DCD1EF] hover:bg-[#F3EEF9] text-[#4C1D95] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar Link'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#F3EEF9] hover:bg-[#E7DDF7] text-[#4C1D95] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Trocar</span>
              </button>
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  aria-label="Remover imagem anexada"
                  className="p-1.5 rounded-lg text-[#7C6B9E] hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center text-center ${
            compact ? 'p-4' : 'p-6'
          } ${
            dragging
              ? 'border-[#6D28D9] bg-[#F3EEF9]'
              : 'border-[#D4C3F2] bg-[#F9F7FD] hover:border-[#6D28D9]/70 hover:bg-[#F3EEF9]/70'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-[#6D28D9] animate-spin mb-1.5" />
          ) : (
            <UploadCloud className="w-6 h-6 text-[#6D28D9] mb-1.5" />
          )}
          <p className="text-xs font-semibold text-[#2E1A47]">
            {uploading ? 'Enviando imagem...' : 'Arraste uma imagem ou clique para enviar'}
          </p>
          <p className="text-[11px] text-[#6B5B8E] mt-0.5">{helperText}</p>
        </div>
      )}
    </div>
  );
}
