# G29-S1 md.1 — KCAL yerel Expo modülü (repo içinde, npm paketi DEĞİL).
# iOS 17+ Vision VNGenerateForegroundInstanceMaskRequest ile tabak fotoğrafından çıkartma.
# Dağıtım hedefi uygulamayla aynı (15.1); iOS 17 altı çalışma anında kapalı (#available).
# SDWebImageWebPCoder zaten derlemede (expo-image-manipulator bağımlılığı) — yeni pod indirilmez.
Pod::Spec.new do |s|
  s.name           = 'SubjectLift'
  s.version        = '1.0.0'
  s.summary        = 'On-device subject lift for meal photos (Vision).'
  s.description    = 'KCAL local Expo module: lifts the plate from a meal photo on device (iOS 17+ Vision foreground instance mask) into a transparent, cropped WebP sticker.'
  s.license        = 'UNLICENSED'
  s.author         = 'KCAL'
  s.homepage       = 'https://eatkcal.com'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'SDWebImageWebPCoder'
  s.frameworks = 'Vision', 'CoreImage', 'CoreVideo'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
