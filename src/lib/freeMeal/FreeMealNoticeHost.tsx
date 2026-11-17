// G58-S2 md.4 — kupon tanımlanınca uygulama içi bildirim: "2 öğünün kupon kısmına tanımlandı" + "Gör"
// → Profil › Kuponlar (Kuponlarım sekmesi). Oturum açılınca ve uygulama öne her gelişte bir kez sorar;
// gösterilen bildirimler sunucuda görüldü işaretlenir (bir kez).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '../../core/design/components/Toast';
import { useT } from '../../core/i18n';
import { useAuth } from '../../core/AuthContext';
import { navigationRef } from '../../navigation/navigationRef';
import { fetchFreeMealNotices, markFreeMealNoticesSeen } from './api';
import { freeMealNoticeKey } from './rules';

export function FreeMealNoticeHost() {
  const { session } = useAuth();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const busy = useRef(false);
  const userId = session?.user?.id ?? null;

  const check = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    try {
      const notices = await fetchFreeMealNotices();
      const k = freeMealNoticeKey(notices);
      if (!k) return;
      setMsg(tr(k.key, { n: k.n }));
      void markFreeMealNoticesSeen(notices.map((x) => x.id));
    } finally {
      busy.current = false;
    }
  }, [userId, tr]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  if (!msg) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} testID="free-meal-notice">
      <Toast
        visible
        message={msg}
        autoHideMs={8000}
        onView={() => {
          setMsg(null);
          if (navigationRef.isReady()) navigationRef.navigate('ProfileCoupons', { tab: 'mine' });
        }}
        onDismiss={() => setMsg(null)}
      />
    </View>
  );
}
