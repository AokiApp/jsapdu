package app.aoki.jsapdu.rn.utils

import com.margelo.nitro.core.ArrayBuffer
import java.nio.ByteBuffer

object ArrayBufferUtils {
    fun copyToByteArray(buffer: ArrayBuffer): ByteArray {
        val byteBuffer: ByteBuffer = buffer.getBuffer(copyIfNeeded = true)
        val bytes = ByteArray(byteBuffer.remaining())
        byteBuffer.get(bytes)
        return bytes
    }
    fun fromByteArray(data: ByteArray): ArrayBuffer {

        val byteBuffer = ByteBuffer.allocateDirect(data.size)
        byteBuffer.put(data)
        byteBuffer.flip()
        return ArrayBuffer.wrap(byteBuffer)
    }
}