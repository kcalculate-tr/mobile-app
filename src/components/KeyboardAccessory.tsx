// NÖTRALİZE EDİLDİ.
// iOS native InputAccessoryView, RN 0.81 / Fabric (new architecture) altında bu
// projede cihazda RENDER OLMUYOR (TestFlight'ta 4 ayrı denemede doğrulandı). Bu
// yüzden dismiss "Kapat" barı artık tamamen global KeyboardToolbar (klavye-takipli
// absolute JS overlay) tarafından sağlanıyor — bkz. src/components/KeyboardToolbar.tsx.
//
// Bu component artık no-op (null) döner. Export'lar korunuyor ki ekranlardaki mevcut
// `<KeyboardAccessory nativeID={...} />` mount'ları ve TextInput'lardaki
// `inputAccessoryViewID` prop'ları zararsız (görünmez) kalsın — temizlik churn'ü
// olmadan. İleride InputAccessoryView Fabric'te düzelirse burası tek noktadan
// yeniden etkinleştirilebilir.

export const DEFAULT_ACCESSORY_ID = 'kcal_default_accessory';

export function KeyboardAccessory(_props?: { nativeID?: string }): null {
  return null;
}

export default KeyboardAccessory;
