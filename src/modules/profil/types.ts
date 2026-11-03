// Profil tipleri — G5-CONTRACT.md "Kayıt: iki şablon" + profil RPC imzaları.

export type FollowState = 'following' | 'requested' | 'none';

export interface ClaimResult {
  ok: boolean;
  reason: string | null; // sunucu: 'taken' | 'invalid' | null
}

// check_handle(p_handle) → SALT OKUR benzersizlik kontrolü (rezervasyon yapmaz).
export interface CheckHandleResult {
  available: boolean;
  reason: string | null; // 'format' | 'reserved' | 'taken' | null
}

export interface PublicProfile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  verified: boolean;
  is_private: boolean;
  followers: number;
  following: number;
  posts: number;
  me_following: FollowState;
  me_requested?: boolean; // G6: bekleyen takip isteğim var mı (gizli hesap)
}

export interface DeliveryCityResult {
  ok: boolean;
  reason: string | null; // ör. 'not_izmir'
}

// İki kayıt şablonu — akış mantığı hook'larda, bu tipler durumu taşır.
export type RegistrationTemplate = 'kcalculate_ai' | 'eatkcal';

// İstemci arayüzü — gerçek RPC (client.ts) ve mock (mock.ts) uygular.
export interface ProfilClient {
  // check_handle(p_handle) → SALT OKUR; canlı (debounce) kontrol için. Rezerve etmez.
  checkHandle(params: { handle: string }): Promise<CheckHandleResult>;
  // claim_handle(p_handle) → nihai sahiplenme; benzersizliği SUNUCU denetler (idempotent).
  claimHandle(params: { handle: string }): Promise<ClaimResult>;
  updatePublicProfile(params: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
  }): Promise<void>;
  getPublicProfile(params: { handle: string }): Promise<PublicProfile | null>;
  // follow(p_user, p_on) → gizli hesaba istek gider.
  follow(params: { user: string; on: boolean }): Promise<{ state: FollowState }>;
  respondFollowRequest(params: { requester: string; accept: boolean }): Promise<void>;
  // Gizli/açık hesap. (RPC adı SORULAR: set_profile_privacy varsayıldı.)
  setPrivacy(params: { isPrivate: boolean }): Promise<void>;
  // eatkcal ilk sipariş şehir kapısı — teslimat yalnız İzmir; sunucu doğrular.
  checkDeliveryCity(params: { city: string }): Promise<DeliveryCityResult>;
}
