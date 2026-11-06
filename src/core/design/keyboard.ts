/**
 * G16-S2 — Android uyumu: klavye. TEK KAYNAK.
 *
 * Expo SDK 54 Android'de kenar-kenar (edge-to-edge) varsayılan AÇIK
 * (@expo/prebuild-config withEdgeToEdge; Android 16'da kapatılamaz). Kenar-kenar
 * pencerede `adjustResize` pencereyi küçültmez → `behavior={ios ? 'padding' :
 * undefined}` olan ekranlarda giriş alanı (adres, not, kod) klavyenin altında
 * kalıyordu. Ekran (Modal OLMAYAN) KeyboardAvoidingView'ları iki platformda da
 * 'padding' kullanır (iOS'ta değer zaten 'padding' → iOS AYNEN). Modal içindeki
 * sheet'ler kendi pencerelerinde yeniden boyutlandığından bunu KULLANMAZ.
 */
export const SCREEN_KEYBOARD_BEHAVIOR = 'padding' as const;
