type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type SupabaseErrorInfo = {
  code: string;
  message: string;
  details: string;
  hint: string;
  combinedText: string;
};

const toSafeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const getSupabaseErrorInfo = (error: unknown): SupabaseErrorInfo => {
  const supabaseError =
    error && typeof error === 'object'
      ? (error as SupabaseLikeError)
      : ({} as SupabaseLikeError);

  const code = toSafeString(supabaseError.code).toUpperCase();
  const message = toSafeString(supabaseError.message);
  const details = toSafeString(supabaseError.details);
  const hint = toSafeString(supabaseError.hint);

  return {
    code,
    message,
    details,
    hint,
    combinedText: `${code} ${message} ${details} ${hint}`.toLowerCase(),
  };
};

const mapByCode = (code: string) => {
  if (code === '42501') {
    return 'Bu işlem için yetkiniz yok. Lütfen tekrar giriş yapın.';
  }

  if (code === '23503') {
    return 'İlişkili kayıt bulunamadı. Lütfen verileri kontrol edip tekrar deneyin.';
  }

  if (code === '23505') {
    return 'Bu kayıt zaten mevcut.';
  }

  if (code === '22P02') {
    return 'Gönderilen bilgiler geçersiz formatta.';
  }

  if (code === 'PGRST116') {
    return 'Kayıt bulunamadı.';
  }

  return '';
};

const mapByText = (text: string) => {
  if (
    text.includes('row-level security') ||
    text.includes('violates row-level security policy') ||
    text.includes('permission denied')
  ) {
    return 'Bu işlem için yetkiniz yok. Lütfen tekrar giriş yapın.';
  }

  if (text.includes('jwt') && text.includes('expired')) {
    return 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
  }

  if (text.includes('network request failed') || text.includes('failed to fetch')) {
    return 'Ağ bağlantısı kurulamadı. Lütfen internetinizi kontrol edip tekrar deneyin.';
  }

  if (
    text.includes('canceling statement due to statement timeout') ||
    text.includes('statement timeout')
  ) {
    return 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.';
  }

  return '';
};

export const mapSupabaseErrorToUserMessage = (
  error: unknown,
  fallbackMessage: string,
) => {
  const info = getSupabaseErrorInfo(error);
  const mapped = mapByCode(info.code) || mapByText(info.combinedText);
  if (mapped) return mapped;

  const directMessage = info.message;
  const directMessageLowered = directMessage.toLowerCase();
  const technicalTokens = [
    'supabase',
    'postgres',
    'column',
    'relation',
    'violates',
    'row-level security',
    'permission denied',
    'failed to fetch',
    'network request failed',
    'jwt',
  ];
  const looksTechnical = technicalTokens.some((token) =>
    directMessageLowered.includes(token),
  );

  if (directMessage && !looksTechnical) {
    return directMessage;
  }

  return fallbackMessage;
};

export const formatSupabaseErrorForDevLog = (error: unknown) => {
  const info = getSupabaseErrorInfo(error);
  return `code=${info.code || 'N/A'} message=${info.message || 'N/A'} details=${info.details || 'N/A'} hint=${info.hint || 'N/A'}`;
};
