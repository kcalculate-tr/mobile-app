// Öğün tipi eşlemesi — TEK KAYNAK.
//
// Sorun (G7-S1): Keşfet/Gün/AI tarama istemci kodu öğün tipini İngilizce kodla
// (`breakfast|lunch|dinner|snack`) taşıyor; sunucu (`meal_consumptions.meal_type`,
// canlı TrackerScreen ve tüm RPC'ler) Türkçe kodu (`kahvalti|ogle|aksam|atistirma`)
// bekliyor. Önceden istemci kodu doğrudan İngilizce değeri gönderiyordu → sunucuya
// yanlış öğün tipi yazılıyordu. Artık sunucuya giden HER çağrı `toServerMealType`,
// sunucudan OKUNAN her değer `toClientMealType` ile bu modülden geçer.

export type ClientMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type ServerMealType = 'kahvalti' | 'ogle' | 'aksam' | 'atistirma';

const CLIENT_TO_SERVER: Record<ClientMealType, ServerMealType> = {
  breakfast: 'kahvalti',
  lunch: 'ogle',
  dinner: 'aksam',
  snack: 'atistirma',
};

const SERVER_TO_CLIENT: Record<ServerMealType, ClientMealType> = {
  kahvalti: 'breakfast',
  ogle: 'lunch',
  aksam: 'dinner',
  atistirma: 'snack',
};

function isClientMealType(v: string): v is ClientMealType {
  return v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack';
}

function isServerMealType(v: string): v is ServerMealType {
  return v === 'kahvalti' || v === 'ogle' || v === 'aksam' || v === 'atistirma';
}

// İstemci → sunucu. Zaten sunucu kodu verilirse (ör. elle oluşturulmuş kayıt)
// olduğu gibi döner; tanınmayan değer güvenli varsayılan 'atistirma' olur.
export function toServerMealType(meal: string): ServerMealType {
  if (isClientMealType(meal)) return CLIENT_TO_SERVER[meal];
  if (isServerMealType(meal)) return meal;
  return 'atistirma';
}

// Sunucu → istemci. Zaten istemci kodu verilirse olduğu gibi döner; tanınmayan
// değer güvenli varsayılan 'snack' olur.
export function toClientMealType(meal: string): ClientMealType {
  if (isServerMealType(meal)) return SERVER_TO_CLIENT[meal];
  if (isClientMealType(meal)) return meal;
  return 'snack';
}
