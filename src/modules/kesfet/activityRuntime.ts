// G57 — çalışma zamanı bağları (native): gönderi medya adresi çözümü + ilk eylem bildirimi depolaması.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { takeFirstActionTip, type MyActivityKind } from './myActivity';

export { resolvePostMediaUrl } from './client';

export function firstActionTip(kind: MyActivityKind): Promise<boolean> {
  return takeFirstActionTip(AsyncStorage as unknown as Parameters<typeof takeFirstActionTip>[0], kind);
}
