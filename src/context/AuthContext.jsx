import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const AuthContext = createContext(null);

function getProfileAvatar(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.avatar_url || row.photo_url || row.image_url || '').trim();
}

async function upsertProfileAvatar(userId, url) {
  if (!userId || !url) return;

  const upsertRes = await supabase
    .from('profiles')
    .upsert({ user_id: userId, avatar_url: url }, { onConflict: 'user_id' });

  if (!upsertRes.error) return;

  const updateByUserId = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('user_id', userId);

  if (!updateByUserId.error) return;

  await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Race condition guard: onAuthStateChange async olmadığı için birden fazla
  // event aynı anda gelirse (token yenileme + session sync) önceki call
  // bitmeden ikincisi başlamamalı.
  const hydratingRef = useRef(false);

  const updateAvatar = useCallback((nextUrl) => {
    const normalized = String(nextUrl || '').trim();
    setAvatarUrl(normalized);
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        user_metadata: {
          ...(prev.user_metadata || {}),
          avatar_url: normalized,
          picture: normalized,
        },
      };
    });
  }, []);

  const resolveAvatar = useCallback(async (nextUser) => {
    if (!nextUser?.id) return '';

    let resolved = String(
      nextUser?.user_metadata?.avatar_url || nextUser?.user_metadata?.picture || ''
    ).trim();

    let profileRes = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', nextUser.id)
      .maybeSingle();

    if (String(profileRes.error?.code || '') === '42703') {
      profileRes = await supabase
        .from('profiles')
        .select('*')
        .eq('id', nextUser.id)
        .maybeSingle();
    }

    if (!profileRes.error && profileRes.data) {
      resolved = getProfileAvatar(profileRes.data) || resolved;
    }

    return resolved;
  }, []);

  const hydrateUser = useCallback(async (nextUser) => {
    if (!nextUser) {
      setUser(null);
      setAvatarUrl('');
      return;
    }

    setUser(nextUser);
    const resolvedAvatar = await resolveAvatar(nextUser);
    setAvatarUrl(resolvedAvatar);
  }, [resolveAvatar]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      await hydrateUser(authUser || null);
      if (mounted) setAuthLoading(false);
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Eğer bir önceki hydration hâlâ devam ediyorsa yeni event'i yoksay.
      // Bu, token yenileme + oturum sync event'lerinin çakışmasını önler.
      if (hydratingRef.current) return;
      hydratingRef.current = true;

      const nextUser = session?.user || null;
      hydrateUser(nextUser)
        .catch((err) => {
          if (import.meta.env.DEV) console.error('[AuthContext] onAuthStateChange hydration error:', err);
        })
        .finally(() => {
          hydratingRef.current = false;
          setAuthLoading(false);
        });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateUser]);

  const uploadAvatar = useCallback(async (file) => {
    if (!file) throw new Error('Dosya seçilmedi.');
    if (!user?.id) throw new Error('Kullanıcı bulunamadı.');

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Desteklenmeyen dosya formatı.');
    }

    const maxBytes = MAX_AVATAR_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`Dosya boyutu en fazla ${MAX_AVATAR_SIZE_MB}MB olabilir.`);
    }

    setAvatarUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

      const { error: uploadError } = await supabase
        .storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, file, { upsert: false, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
      const publicUrl = String(publicData?.publicUrl || '').trim();
      if (!publicUrl) throw new Error('Avatar URL alınamadı.');

      await upsertProfileAvatar(user.id, publicUrl);
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl, picture: publicUrl } });
      updateAvatar(publicUrl);

      return publicUrl;
    } finally {
      setAvatarUploading(false);
    }
  }, [updateAvatar, user]);

  const value = useMemo(() => ({
    user,
    avatarUrl,
    authLoading,
    avatarUploading,
    updateAvatar,
    uploadAvatar,
  }), [authLoading, avatarUploading, avatarUrl, updateAvatar, uploadAvatar, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
