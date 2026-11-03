// Profil mock istemcisi — __DEV__ deneme ekranı ve testler için. Bellek içi.
// Biçim denetimini handle.ts ile paylaşır; benzersizliği "alınmış" kümesiyle
// taklit eder. Gizli hesaba follow → 'requested'.
import { validateHandle } from './handle';
import type {
  ClaimResult,
  DeliveryCityResult,
  FollowState,
  HandleAvailability,
  ProfilClient,
  PublicProfile,
} from './types';

export interface MockProfilOptions {
  takenHandles?: string[];
  privateUsers?: string[]; // bu id'ler gizli hesap → follow 'requested'
  deliveryCities?: string[]; // teslimat açık şehirler (varsayılan izmir)
}

function sampleProfile(handle: string, isPrivate: boolean): PublicProfile {
  return {
    id: `user-${handle}`,
    display_name: handle,
    handle,
    avatar_url: null,
    bio: null,
    role: 'user',
    verified: false,
    is_private: isPrivate,
    followers: 12,
    following: 7,
    posts: 3,
    me_following: 'none',
  };
}

export function createMockProfilClient(options: MockProfilOptions = {}): ProfilClient & {
  _taken: Set<string>;
  _privacy: boolean;
} {
  const taken = new Set((options.takenHandles ?? ['kcalculate', 'dyt.elif']).map((h) => h.toLowerCase()));
  const privateUsers = new Set(options.privateUsers ?? []);
  const cities = new Set((options.deliveryCities ?? ['izmir']).map((c) => c.toLowerCase()));
  const state = { privacy: false };

  return {
    get _taken() {
      return taken;
    },
    get _privacy() {
      return state.privacy;
    },

    async checkHandle({ handle }): Promise<HandleAvailability> {
      const v = validateHandle(handle);
      if (!v.ok) return { available: false, reason: 'format' };
      if (taken.has(v.normalized)) return { available: false, reason: 'taken' };
      return { available: true, reason: null }; // salt okur — rezerve ETMEZ
    },

    async claimHandle({ handle }): Promise<ClaimResult> {
      const v = validateHandle(handle);
      if (!v.ok) return { ok: false, reason: 'invalid' };
      if (taken.has(v.normalized)) return { ok: false, reason: 'taken' };
      taken.add(v.normalized); // rezerve et
      return { ok: true, reason: null };
    },

    async updatePublicProfile(): Promise<void> {
      // mock: yut
    },

    async getPublicProfile({ handle }): Promise<PublicProfile | null> {
      const h = handle.toLowerCase();
      if (!taken.has(h)) return null;
      return sampleProfile(h, privateUsers.has(`user-${h}`));
    },

    async follow({ user, on }): Promise<{ state: FollowState }> {
      if (!on) return { state: 'none' };
      return { state: privateUsers.has(user) ? 'requested' : 'following' };
    },

    async respondFollowRequest(): Promise<void> {
      // mock: yut
    },

    async setPrivacy({ isPrivate }): Promise<void> {
      state.privacy = isPrivate;
    },

    async checkDeliveryCity({ city }): Promise<DeliveryCityResult> {
      const ok = cities.has(city.toLowerCase());
      return { ok, reason: ok ? null : 'not_izmir' };
    },
  };
}

export const mockProfilClient = createMockProfilClient();
