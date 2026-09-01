package com.syncnote.preview

import android.graphics.Bitmap
import android.graphics.BitmapFactory

object AndroidImageEngine {
    private const val THUMB_SIZE = 320

    fun decodeThumbnail(bytes: ByteArray): Bitmap? {
        val opts = BitmapFactory.Options().apply {
            inPreferredConfig = Bitmap.Config.ARGB_8888
            inSampleSize = calcSampleSize(bytes, THUMB_SIZE)
        }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
    }

    private fun calcSampleSize(bytes: ByteArray, target: Int): Int {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var size = 1
        while (bounds.outWidth / (size * 2) >= target && bounds.outHeight / (size * 2) >= target) size *= 2
        return size
    }
}
