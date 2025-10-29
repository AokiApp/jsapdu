package app.aoki.jsapdu.rn.utils

object ArrayBufferUtils {
    fun copyToByteArray(buffer: ArrayBuffer): ByteArray {
        val byteBuffer = buffer.toByteBuffer()
        val byteArray = ByteArray(byteBuffer.remaining())
        byteBuffer.get(byteArray)
        return byteArray
    }
    fun fromByteArray(data: ByteArray): ArrayBuffer {
        return ArrayBuffer.fromByteArray(data)
    }
}