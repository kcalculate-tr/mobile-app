// Profil gerçek RPC istemcisi. Benzersizlik/yetki/gizlilik SUNUCUDA denetlenir.
// `core/supabase` tembel require (Node testleri için — kesfet/client.ts ile aynı).
// RPC adları G6-CONTRACT.md "Profil" bölümünde doğrulandı.
import type {
  ClaimResult,
  DeliveryCityResult,
  FollowState,
  HandleAvailability,
  ProfilClient,
  PublicProfile,
} from './types';

type SupabaseModule = typeof import('../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
}

function rpcError(name: string, error: { message: string }): never {
  throw new Error(`${name}: ${error.message}`);
}

export const realProfilClient: ProfilClient = {
  async checkHandle({ handle }): Promise<HandleAvailability> {
    const { data, error } = await sb().rpc('check_handle', { p_handle: handle });
    if (error) rpcError('check_handle', error);
    return data as HandleAvailability;
  },

  async claimHandle({ handle }): Promise<ClaimResult> {
    const { data, error } = await sb().rpc('claim_handle', { p_handle: handle });
    if (error) rpcError('claim_handle', error);
    return data as ClaimResult;
  },

  async updatePublicProfile({ displayName, bio, avatarUrl }): Promise<void> {
    const { error } = await sb().rpc('update_public_profile', {
      p_display_name: displayName,
      p_bio: bio,
      p_avatar_url: avatarUrl,
    });
    if (error) rpcError('update_public_profile', error);
  },

  async getPublicProfile({ handle }): Promise<PublicProfile | null> {
    const { data, error } = await sb().rpc('get_public_profile', { p_handle: handle });
    if (error) rpcError('get_public_profile', error);
    return (data as PublicProfile) ?? null;
  },

  async follow({ user, on }): Promise<{ state: FollowState }> {
    const { data, error } = await sb().rpc('follow', { p_user: user, p_on: on });
    if (error) rpcError('follow', error);
    return data as { state: FollowState };
  },

  async respondFollowRequest({ requester, accept }): Promise<void> {
    const { error } = await sb().rpc('respond_follow_request', {
      p_requester: requester,
      p_accept: accept,
    });
    if (error) rpcError('respond_follow_request', error);
  },

  async setPrivacy({ isPrivate }): Promise<void> {
    const { error } = await sb().rpc('set_profile_privacy', { p_is_private: isPrivate });
    if (error) rpcError('set_profile_privacy', error);
  },

  async checkDeliveryCity({ city }): Promise<DeliveryCityResult> {
    const { data, error } = await sb().rpc('check_delivery_city', { p_city: city });
    if (error) rpcError('check_delivery_city', error);
    return data as DeliveryCityResult;
  },
};

let activeClient: ProfilClient = realProfilClient;

export function getProfilClient(): ProfilClient {
  return activeClient;
}

export function setProfilClient(client: ProfilClient): void {
  activeClient = client;
}

export function resetProfilClient(): void {
  activeClient = realProfilClient;
}
