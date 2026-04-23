import React, { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { supabase } from '../supabase';

const IMAGE_BUCKET = 'images';
const MAX_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function buildPath(folder, filename) {
  const ext = filename.split('.').pop();
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return `${folder}/${base}_${Date.now()}.${ext}`;
}

function measureDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function formatAspect(w, h) {
  const d = gcd(w, h);
  const rw = w / d;
  const rh = h / d;
  if (rw > 20 || rh > 20) return `${(w / h).toFixed(2)}:1`;
  return `${rw}:${rh}`;
}

export default function ImageUploadField({
  label = 'Görsel',
  value,
  onUploaded,
  folder = 'admin',
  className = '',
  aspectRatio,
  aspectTolerance = 0.05,
  aspectLabel,
  recommendedSize,
  showMobilePreview = false,
  mobilePreviewSize = { width: 343, height: 170 },
  mobilePreviewLabel = 'Mobilde nasıl görünecek',
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [aspectWarn, setAspectWarn] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setAspectWarn('');

    if (!ALLOWED.includes(file.type)) {
      setErr('Desteklenmeyen format. JPG, PNG, WEBP veya GIF yükleyin.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`Maks. ${MAX_MB}MB.`);
      e.target.value = '';
      return;
    }

    if (aspectRatio) {
      const dims = await measureDimensions(file);
      if (dims && dims.width > 0 && dims.height > 0) {
        const actual = dims.width / dims.height;
        const delta = Math.abs(actual - aspectRatio) / aspectRatio;
        if (delta > aspectTolerance) {
          const shown = formatAspect(dims.width, dims.height);
          const target = aspectLabel || `${aspectRatio}:1`;
          const sizeHint = recommendedSize ? ` (örn. ${recommendedSize})` : '';
          setAspectWarn(
            `⚠️ Banner ${target} aspect oranında olmalı${sizeHint}. Yüklediğiniz görsel ${dims.width}×${dims.height} (${shown}). Devam etmek zorunda değilsiniz ama görsel mobilde kırpılacak.`
          );
        }
      }
    }

    setUploading(true);
    try {
      const path = buildPath(folder, file.name);
      const { error: upErr } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Public URL alınamadı.');
      onUploaded(data.publicUrl);
    } catch (e2) {
      setErr(String(e2?.message || 'Yükleme hatası'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <p className="text-xs font-semibold text-gray-600">{label}</p>}
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? 'Yükleniyor…' : 'Yükle'}
          <input type="file" accept={ALLOWED.join(',')} onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => { onUploaded(''); setAspectWarn(''); }}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-red-500"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      {aspectWarn && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {aspectWarn}
        </p>
      )}
      {value && (
        <div className="flex flex-wrap items-start gap-3">
          <img src={value} alt="önizleme" className="h-24 w-40 rounded-xl border border-gray-100 object-cover" />
          {showMobilePreview && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-gray-500">{mobilePreviewLabel} ({mobilePreviewSize.width}×{mobilePreviewSize.height})</p>
              <div
                className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm"
                style={{ width: mobilePreviewSize.width, height: mobilePreviewSize.height }}
              >
                <img src={value} alt="mobil önizleme" className="h-full w-full object-cover" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
