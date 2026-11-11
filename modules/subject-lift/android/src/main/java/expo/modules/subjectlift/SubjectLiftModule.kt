// G29-S1 md.1 — Çıkartma (subject lift), Android.
// ML Kit Subject Segmentation (Google Play hizmetleri) → ön plan bitmap'i (arka plan şeffaf) →
// nesneye kırpılmış, en çok `maxSize` px WebP. Tamamen cihazda: görüntü ağa gitmez.
// Model ilk kullanımda Play hizmetleriyle iner (manifest meta-data `subject_segment`);
// inmemişse / desteklenmiyorsa işlem hata verir → promise reddedilir → JS tarafı
// (src/lib/sticker/subjectLift.ts) sessizce normal fotoğrafa düşer. 1,5 sn sınırı JS'te.
package expo.modules.subjectlift

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class SubjectLiftModule : Module() {
  private val executor: ExecutorService = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("SubjectLift")

    // Play hizmetleri / model durumu burada bilinmez; denenir, olmazsa sessizce atlanır.
    Function("isAvailable") {
      true
    }

    AsyncFunction("liftAsync") { uri: String, maxSize: Int, quality: Double, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_SUBJECT_LIFT", "no_context", null)
      } else {
        executor.execute { run(context.applicationContext, uri, maxSize, quality, promise) }
      }
    }

    OnDestroy {
      executor.shutdown()
    }
  }

  private fun run(context: Context, uri: String, maxSize: Int, quality: Double, promise: Promise) {
    val source: Bitmap
    try {
      source = decodeUpright(context, uri) ?: throw IllegalStateException("decode_failed")
    } catch (e: Throwable) {
      promise.reject("ERR_SUBJECT_LIFT", e.message ?: "decode_failed", e)
      return
    }
    val options = SubjectSegmenterOptions.Builder()
      .enableForegroundBitmap()
      .build()
    val segmenter = SubjectSegmentation.getClient(options)
    try {
      segmenter.process(InputImage.fromBitmap(source, 0))
        .addOnSuccessListener(executor) { result ->
          try {
            val foreground = result.foregroundBitmap ?: throw IllegalStateException("no_subject")
            promise.resolve(finish(context, foreground, source.width, source.height, maxSize, quality))
          } catch (e: Throwable) {
            promise.reject("ERR_SUBJECT_LIFT", e.message ?: "lift_failed", e)
          } finally {
            segmenter.close()
          }
        }
        .addOnFailureListener(executor) { e ->
          segmenter.close()
          // Model inmemiş (UNAVAILABLE) dahil her hata: çıkartma yok.
          promise.reject("ERR_SUBJECT_LIFT", e.message ?: "segment_failed", e)
        }
    } catch (e: Throwable) {
      segmenter.close()
      promise.reject("ERR_SUBJECT_LIFT", e.message ?: "segment_failed", e)
    }
  }

  private fun open(context: Context, uri: String): InputStream? {
    val parsed = Uri.parse(uri)
    return when (parsed.scheme) {
      null, "" -> File(uri).inputStream()
      "file" -> File(parsed.path ?: return null).inputStream()
      else -> context.contentResolver.openInputStream(parsed)
    }
  }

  /** EXIF yönü uygulanmış bitmap; uzun kenar en çok DECODE_LIMIT (bellek + hız). */
  private fun decodeUpright(context: Context, uri: String): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(context, uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= DECODE_LIMIT) sample *= 2
    val opts = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    val decoded = open(context, uri)?.use { BitmapFactory.decodeStream(it, null, opts) } ?: return null
    val rotation = try {
      open(context, uri)?.use { stream ->
        when (ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90f
          ExifInterface.ORIENTATION_ROTATE_180 -> 180f
          ExifInterface.ORIENTATION_ROTATE_270 -> 270f
          else -> 0f
        }
      } ?: 0f
    } catch (e: Throwable) {
      0f
    }
    if (rotation == 0f) return decoded
    val matrix = Matrix().apply { postRotate(rotation) }
    val rotated = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    if (rotated !== decoded) decoded.recycle()
    return rotated
  }

  private fun finish(
    context: Context,
    foreground: Bitmap,
    sourceWidth: Int,
    sourceHeight: Int,
    maxSize: Int,
    quality: Double,
  ): Map<String, Any?> {
    val w = foreground.width
    val h = foreground.height
    val pixels = IntArray(w * h)
    foreground.getPixels(pixels, 0, w, 0, 0, w, h)
    var minX = w
    var minY = h
    var maxX = -1
    var maxY = -1
    for (y in 0 until h) {
      val row = y * w
      for (x in 0 until w) {
        if ((pixels[row + x] ushr 24) > ALPHA_THRESHOLD) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < minX || maxY < minY) throw IllegalStateException("no_subject")
    val boxW = maxX - minX + 1
    val boxH = maxY - minY + 1
    if (boxW.toLong() * boxH < (w.toLong() * h * MIN_AREA_PERCENT) / 100) throw IllegalStateException("subject_too_small")

    val cropped = Bitmap.createBitmap(foreground, minX, minY, boxW, boxH)
    val limit = maxOf(64, maxSize)
    val scale = minOf(1.0, limit.toDouble() / maxOf(boxW, boxH))
    val outW = maxOf(1, Math.round(boxW * scale).toInt())
    val outH = maxOf(1, Math.round(boxH * scale).toInt())
    val sticker = if (outW == boxW && outH == boxH) cropped else Bitmap.createScaledBitmap(cropped, outW, outH, true)

    val q = (quality.coerceIn(0.1, 1.0) * 100).toInt()
    val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Bitmap.CompressFormat.WEBP_LOSSY
    } else {
      @Suppress("DEPRECATION")
      Bitmap.CompressFormat.WEBP
    }
    val file = File(context.cacheDir, "kcal-sticker-${UUID.randomUUID()}.webp")
    FileOutputStream(file).use { out ->
      if (!sticker.compress(format, q, out)) throw IllegalStateException("encode_failed")
    }
    if (sticker !== cropped) sticker.recycle()
    cropped.recycle()

    // Ön plan bitmap'i girdiyle aynı boyutta; kutu 0…1 (üst-sol köşeden).
    return mapOf(
      "uri" to Uri.fromFile(file).toString(),
      "width" to outW,
      "height" to outH,
      "format" to "webp",
      "bytes" to file.length().toInt(),
      "sourceWidth" to sourceWidth,
      "sourceHeight" to sourceHeight,
      "cropX" to minX.toDouble() / w,
      "cropY" to minY.toDouble() / h,
      "cropWidth" to boxW.toDouble() / w,
      "cropHeight" to boxH.toDouble() / h,
    )
  }

  companion object {
    private const val DECODE_LIMIT = 1280
    private const val ALPHA_THRESHOLD = 128
    private const val MIN_AREA_PERCENT = 2L
  }
}
