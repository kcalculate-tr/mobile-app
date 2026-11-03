// Profil tipleri — G5-CONTRACT.md "Kayıt: iki şablon" + profil RPC imzaları.

export type FollowState = 'following' | 'requested' | 'none';

export interface ClaimResult {
  ok: boolean;
  reason: string | null; // sunucu: 'taken' | 'invalid' | null
}

export interface HandleAvailability {
  available: boolean;
  reason: 'format' | 'taken' | 'reserved' | null;
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
}

export interface DeliveryCityResult {
  ok: boolean;
  reason: string | null; // ör. 'not_izmir'
}

// İki kayıt şablonu — akış mantığı hook'larda, bu tipler durumu taşır.
export type RegistrationTemplate = 'kcalculate_ai' | 'eatkcal';

// İstemci arayüzü — gerçek RPC (client.ts) ve mock (mock.ts) uygular.
export interface ProfilClient {
  // check_handle(p_handle) → SALT OKUR, rezervasyon yapmaz. Canlı kontrolde kullanılır.
  checkHandle(params: { handle: string }): Promise<HandleAvailability>;
  // claim_handle(p_handle) → benzersizliği SUNUCU denetler; idempotent (aynı kullanıcı aynı handle).
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
