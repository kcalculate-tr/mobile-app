// G29-S1 md.1 — Çıkartma (subject lift), iOS.
// iOS 17+ Vision `VNGenerateForegroundInstanceMaskRequest` → ön plan maskesi → arka planı
// şeffaf, nesneye kırpılmış, en çok `maxSize` px WebP (SDWebImageWebPCoder; yoksa PNG).
// Tamamen cihazda: ağ yok, sunucuya ek veri gitmez. iOS 17 altı: isAvailable() = false.
// Her hata promise'i reddeder; JS tarafı (src/lib/sticker/subjectLift.ts) sessizce normal
// fotoğrafa düşer ve 1,5 sn süre sınırını kendisi uygular — akış asla beklemez.
import ExpoModulesCore
import UIKit
import Vision
import CoreImage
import CoreVideo
#if canImport(SDWebImageWebPCoder)
import SDWebImageWebPCoder
#endif

public class SubjectLiftModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SubjectLift")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    AsyncFunction("liftAsync") { (uri: String, maxSize: Int, quality: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard #available(iOS 17.0, *) else {
          promise.reject("ERR_SUBJECT_LIFT_UNSUPPORTED", "Subject lift requires iOS 17 or later")
          return
        }
        do {
          let result = try SubjectLifter.lift(uri: uri, maxSize: maxSize, quality: quality)
          promise.resolve(result)
        } catch {
          promise.reject("ERR_SUBJECT_LIFT", String(describing: error))
        }
      }
    }
  }
}

enum SubjectLiftError: Error {
  case badUri
  case decodeFailed
  case noSubject
  case subjectTooSmall
  case renderFailed
  case encodeFailed
}

@available(iOS 17.0, *)
enum SubjectLifter {
  /// Alfa eşiği (maske 0…1) ve en küçük nesne payı (fotoğraf alanına oranı).
  static let maskThreshold: Float = 0.5
  static let minAreaRatio: CGFloat = 0.02

  static func lift(uri: String, maxSize: Int, quality: Double) throws -> [String: Any] {
    let url: URL
    if let parsed = URL(string: uri), parsed.scheme != nil {
      url = parsed
    } else {
      url = URL(fileURLWithPath: uri)
    }
    guard url.isFileURL else { throw SubjectLiftError.badUri }
    guard let loaded = UIImage(contentsOfFile: url.path) else { throw SubjectLiftError.decodeFailed }
    guard let source = upright(loaded) else { throw SubjectLiftError.decodeFailed }

    let width = source.width
    let height = source.height
    let handler = VNImageRequestHandler(cgImage: source, orientation: .up, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])
    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      throw SubjectLiftError.noSubject
    }
    // Tam çözünürlüklü maske (fotoğrafla aynı boyut) — hem kırpma kutusu hem birleştirme için.
    let mask = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)
    guard let box = boundingBox(of: mask, threshold: maskThreshold) else { throw SubjectLiftError.noSubject }
    if box.width * box.height < CGFloat(width * height) * minAreaRatio { throw SubjectLiftError.subjectTooSmall }

    let image = CIImage(cgImage: source)
    let maskImage = CIImage(cvPixelBuffer: mask)
    guard let blend = CIFilter(name: "CIBlendWithMask") else { throw SubjectLiftError.renderFailed }
    blend.setValue(image, forKey: kCIInputImageKey)
    blend.setValue(CIImage.empty(), forKey: kCIInputBackgroundImageKey)
    blend.setValue(maskImage, forKey: kCIInputMaskImageKey)
    guard let output = blend.outputImage else { throw SubjectLiftError.renderFailed }

    // Core Image koordinatı sol alttan: üstten ölçülen kutuyu çevir.
    let ciRect = CGRect(x: box.minX, y: CGFloat(height) - box.maxY, width: box.width, height: box.height)
    let context = CIContext(options: nil)
    guard let cropped = context.createCGImage(output, from: ciRect) else { throw SubjectLiftError.renderFailed }

    // En çok maxSize px (uzun kenar), şeffaf zemin.
    let longSide = max(box.width, box.height)
    let limit = CGFloat(max(64, maxSize))
    let scale = min(1, limit / longSide)
    let outSize = CGSize(width: max(1, (box.width * scale).rounded()), height: max(1, (box.height * scale).rounded()))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    let renderer = UIGraphicsImageRenderer(size: outSize, format: format)
    let sticker = renderer.image { _ in
      UIImage(cgImage: cropped).draw(in: CGRect(origin: .zero, size: outSize))
    }

    let q = min(1, max(0.1, quality))
    var data: Data?
    var ext = "png"
    #if canImport(SDWebImageWebPCoder)
    data = SDImageWebPCoder.shared.encodedData(with: sticker, format: .webP, options: [.encodeCompressionQuality: q])
    if data != nil { ext = "webp" }
    #endif
    if data == nil {
      data = sticker.pngData()
      ext = "png"
    }
    guard let bytes = data else { throw SubjectLiftError.encodeFailed }

    let file = FileManager.default.temporaryDirectory
      .appendingPathComponent("kcal-sticker-\(UUID().uuidString).\(ext)")
    try bytes.write(to: file, options: .atomic)

    return [
      "uri": file.absoluteString,
      "width": Int(outSize.width),
      "height": Int(outSize.height),
      "format": ext,
      "bytes": bytes.count,
      "sourceWidth": width,
      "sourceHeight": height,
      // Kırpma kutusu, kaynak fotoğrafa göre 0…1 (üst-sol köşeden) — ekranda çıkartmayı
      // fotoğrafın üstüne birebir oturtmak için.
      "cropX": Double(box.minX) / Double(width),
      "cropY": Double(box.minY) / Double(height),
      "cropWidth": Double(box.width) / Double(width),
      "cropHeight": Double(box.height) / Double(height),
    ]
  }

  /// EXIF yönü uygulanmış (dik) CGImage, ölçek 1.
  static func upright(_ image: UIImage) -> CGImage? {
    if image.imageOrientation == .up, let cg = image.cgImage { return cg }
    let size = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
    guard size.width >= 1, size.height >= 1 else { return nil }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }.cgImage
  }

  /// Maskede eşiği aşan piksellerin kutusu (üst-sol köşeden, piksel). Boşsa nil.
  static func boundingBox(of buffer: CVPixelBuffer, threshold: Float) -> CGRect? {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
    let w = CVPixelBufferGetWidth(buffer)
    let h = CVPixelBufferGetHeight(buffer)
    let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
    let format = CVPixelBufferGetPixelFormatType(buffer)
    var minX = w
    var minY = h
    var maxX = -1
    var maxY = -1
    for y in 0..<h {
      let row = base.advanced(by: y * rowBytes)
      var rowHit = false
      if format == kCVPixelFormatType_OneComponent32Float {
        let px = row.assumingMemoryBound(to: Float32.self)
        for x in 0..<w where px[x] > threshold {
          if x < minX { minX = x }
          if x > maxX { maxX = x }
          rowHit = true
        }
      } else if format == kCVPixelFormatType_OneComponent8 {
        let px = row.assumingMemoryBound(to: UInt8.self)
        let limit = UInt8(min(255, max(0, threshold * 255)))
        for x in 0..<w where px[x] > limit {
          if x < minX { minX = x }
          if x > maxX { maxX = x }
          rowHit = true
        }
      } else {
        return nil
      }
      if rowHit {
        if y < minY { minY = y }
        maxY = y
      }
    }
    guard maxX >= minX, maxY >= minY else { return nil }
    return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
  }
}
