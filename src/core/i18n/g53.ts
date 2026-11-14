// G53-S1 — Keşfet profil kısayolu, profil fotoğrafı "+" rozeti, paylaşım görsel kılavuzu. Sözlüğün KÖKÜNE
// yayılır (dictionaries.ts → `...g53Tr`): kesfet_me · avatar_edit · share_guide. Kılavuzdaki sayılar METİNDE
// YOK — hepsi koddaki gerçek sınırlardan (kesfet/shareGuide.ts) parametre olarak gelir.

export const tr = {
  kesfet_me: {
    a11y: 'Profilim, paylaşımlarım',
  },
  avatar_edit: {
    badge_a11y: 'Profil fotoğrafını değiştir',
    sheet_title: 'Profil fotoğrafı',
    take: 'Fotoğraf çek',
    library: 'Galeriden seç',
    remove: 'Fotoğrafı kaldır',
    cancel: 'Vazgeç',
    uploading: 'Fotoğraf yükleniyor',
    failed: 'Fotoğraf yüklenemedi. Eski fotoğrafın duruyor.',
    remove_failed: 'Fotoğraf kaldırılamadı.',
    camera_denied: 'Kamera izni yok. Ayarlar’dan izin verebilirsin.',
    retry: 'Tekrar dene',
  },
  share_guide: {
    a11y: 'Görsel kılavuzu',
    title: 'Görsel kılavuzu',
    sub: 'Paylaşımın akışta en iyi böyle görünür.',
    tip: 'İpucu: bu kılavuza istediğin zaman “i” düğmesinden ulaşabilirsin.',
    ratio_title: 'Önerilen oran ve ölçü',
    ratio_portrait: '4:5 dikey (%{w} × %{h})',
    ratio_square: '1:1 kare (%{w} × %{h})',
    crop_note:
      'Fotoğrafın kırpılmadan yüklenir. Akışta tek fotoğraf %{min}–%{max} pt yükseklikte bir çerçevede gösterilir; çerçeveye sığmayan kısım ortadan kırpılır, ana öğeyi ortada tut.',
    count_title: 'Kaç görsel',
    count: 'En fazla %{n} fotoğraf',
    count_video: 'En fazla %{n} fotoğraf ve 1 video',
    size_title: 'Dosya boyutu',
    photo_size: 'Fotoğraf en fazla %{mb} MB. Yüklemeden önce %{q} kalitede sıkıştırılır.',
    video_title: 'Video',
    video_limit: 'En fazla %{s} sn ve %{mb} MB, orta kalitede yüklenir.',
    ok: 'Tamam',
  },
};

export const en: typeof tr = {
  kesfet_me: {
    a11y: 'My profile, my posts',
  },
  avatar_edit: {
    badge_a11y: 'Change profile photo',
    sheet_title: 'Profile photo',
    take: 'Take photo',
    library: 'Choose from library',
    remove: 'Remove photo',
    cancel: 'Cancel',
    uploading: 'Uploading photo',
    failed: 'Couldn’t upload the photo. Your old photo is still there.',
    remove_failed: 'Couldn’t remove the photo.',
    camera_denied: 'No camera access. You can allow it in Settings.',
    retry: 'Try again',
  },
  share_guide: {
    a11y: 'Image guide',
    title: 'Image guide',
    sub: 'This is how your post looks best in the feed.',
    tip: 'Tip: you can open this guide any time with the “i” button.',
    ratio_title: 'Recommended ratio and size',
    ratio_portrait: '4:5 portrait (%{w} × %{h})',
    ratio_square: '1:1 square (%{w} × %{h})',
    crop_note:
      'Your photo is uploaded uncropped. In the feed a single photo is shown in a frame %{min}–%{max} pt tall; anything outside the frame is cropped from the center, so keep the subject centered.',
    count_title: 'How many',
    count: 'Up to %{n} photos',
    count_video: 'Up to %{n} photos and 1 video',
    size_title: 'File size',
    photo_size: 'Photos up to %{mb} MB. They’re compressed to %{q} quality before upload.',
    video_title: 'Video',
    video_limit: 'Up to %{s} s and %{mb} MB, uploaded at medium quality.',
    ok: 'Got it',
  },
};
