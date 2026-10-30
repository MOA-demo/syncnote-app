package com.syncnote.preview

import android.graphics.Bitmap
import android.graphics.ImageDecoder
import java.nio.ByteBuffer

// v2.4.0: BitmapFactory → ImageDecoder 전환
object AndroidImageEngine {
    private const val THUMB_SIZE = 320

    fun decodeThumbnail(bytes: ByteArray): Bitmap? {
        val source = ImageDecoder.createSource(ByteBuffer.wrap(bytes))
        val bitmap = ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            val scale = maxOf(1, minOf(info.size.width, info.size.height) / THUMB_SIZE)
            decoder.setTargetSize(info.size.width / scale, info.size.height / scale)
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
        // 썸네일 메모리 절약
        return bitmap.copy(Bitmap.Config.ALPHA_8, false)
    }
}
