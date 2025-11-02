package app.aoki.jsapdu.rn.omapi

import android.se.omapi.Session
import android.se.omapi.Channel
 // removed reflection import

/**
 * OmapiApduEmulator intercepts SELECT/CHANNEL-management APDUs and translates
 * them into OMAPI session/channel operations, keeping ICardSession API unchanged.
 * Single-channel mode: underlying OMAPI logical channel is opened on SELECT by AID.
 */
class OmapiApduEmulator(private val session: Session) {

    var currentChannel: Channel? = null
        private set

    private var selectedAid: ByteArray? = null

    init {
        // Switch to Logical channels: do not auto-open; open on first SELECT by AID
        currentChannel = null
    }

    fun reset() {
        try {
            currentChannel?.close()
        } catch (_: Exception) {}
        currentChannel = null
        selectedAid = null
    }

    fun release() {
        try {
            currentChannel?.close()
        } catch (_: Exception) {}
        currentChannel = null
    }

    // removed findOpenBasicWithP2; we emulate P2 at transmit-time

    private fun combineResponse(data: ByteArray?): ByteArray {
        val d = data ?: ByteArray(0)
        val sw1 = 0x90.toByte()
        val sw2 = 0x00.toByte()
        return d + byteArrayOf(sw1, sw2)
    }

    fun transmit(apdu: ByteArray): ByteArray {
        val cmd = parse(apdu)
        when {
            isSelectByAid(cmd) -> {
                val aid = cmd.data ?: ByteArray(0)
                if (aid.isEmpty()) {
                    // empty AID: deselect (close current logical channel) and acknowledge
                    selectedAid = null
                    try {
                        currentChannel?.close()
                    } catch (_: Exception) {}
                    currentChannel = null
                    return byteArrayOf(0x90.toByte(), 0x00)
                } else {
                    // open logical channel with AID
                    try {
                        currentChannel?.close()
                    } catch (_: Exception) {}
                    selectedAid = aid
                    currentChannel = session.openLogicalChannel(aid)
                    val ch = currentChannel ?: return byteArrayOf(0x6A.toByte(), 0x82.toByte())
                    if (!ch.isOpen) {
                        return byteArrayOf(0x6A.toByte(), 0x82.toByte())
                    }
                    val sr = ch.selectResponse
                    return combineResponse(sr)
                }
            }
            isSelectNext(cmd) -> {
                val ch = currentChannel ?: return byteArrayOf(0x6A.toByte(), 0x82.toByte())
                return try {
                    val ok = ch.selectNext()
                    val sr = ch.selectResponse
                    if (ok) combineResponse(sr) else byteArrayOf(0x6A.toByte(), 0x82.toByte())
                } catch (_: Exception) {
                    byteArrayOf(0x6A.toByte(), 0x82.toByte())
                }
            }
            isManageChannelOpen(cmd) -> {
                // emulate single channel mode: always return channel number 0 with 9000
                return byteArrayOf(0x00, 0x90.toByte(), 0x00)
            }
            isManageChannelClose(cmd) -> {
                // emulate close: keep single channel but respond success 9000
                return byteArrayOf(0x90.toByte(), 0x00)
            }
            else -> {
                val ch = currentChannel ?: throw IllegalStateException("Channel not available - no logical channel opened. Send SELECT by AID first.")
                
                // Check if channel is still open
                if (!ch.isOpen) {
                    currentChannel = null
                    throw IllegalStateException("Channel not available - logical channel was closed. Send SELECT by AID to reopen.")
                }
                
                // Normalize CLA: clear logical channel bits (nibble) and extended indicator (0x40), preserve SM/proprietary bits
                val normalized = apdu.copyOf()
                normalized[0] = ((normalized[0].toInt() and 0xB0)).toByte()
                
                try {
                    val resp = ch.transmit(normalized) ?: throw IllegalStateException("Null response from channel")
                    return resp
                } catch (e: Exception) {
                    // Channel may have been closed by the secure element
                    if (!ch.isOpen) {
                        currentChannel = null
                        throw IllegalStateException("Channel closed during transmit: ${e.message}")
                    }
                    throw e
                }
            }
        }
    }

    private fun isSelectByAid(cmd: Apdu): Boolean {
        return cmd.ins == 0xA4 && cmd.p1 == 0x04 && cmd.lc != null && cmd.p2 != 0x02
    }

    private fun isSelectNext(cmd: Apdu): Boolean {
        return cmd.ins == 0xA4 && cmd.p1 == 0x04 && cmd.p2 == 0x02 && (selectedAid != null)
    }

    private fun isManageChannelOpen(cmd: Apdu): Boolean {
        return cmd.ins == 0x70 && cmd.p1 == 0x00 && cmd.p2 == 0x00
    }

    private fun isManageChannelClose(cmd: Apdu): Boolean {
        return cmd.ins == 0x70 && cmd.p1 == 0x80
    }

    private data class Apdu(
        val cla: Int,
        val ins: Int,
        val p1: Int,
        val p2: Int,
        val lc: Int?,
        val data: ByteArray?,
        val le: Int?
    )

    private fun parse(apdu: ByteArray): Apdu {
        if (apdu.size < 4) throw IllegalArgumentException("APDU too short")
        val cla = apdu[0].toInt() and 0xFF
        val ins = apdu[1].toInt() and 0xFF
        val p1 = apdu[2].toInt() and 0xFF
        val p2 = apdu[3].toInt() and 0xFF
        var offset = 4
        var lc: Int? = null
        var data: ByteArray? = null
        var le: Int? = null

        if (apdu.size == offset) {
            // case 1: no Lc/Le
            return Apdu(cla, ins, p1, p2, null, null, null)
        }

        val remaining = apdu.size - offset
        when {
            remaining == 1 -> {
                // case 2s: Le only (short)
                le = apdu[offset].toInt() and 0xFF
            }
            remaining >= 1 -> {
                lc = apdu[offset].toInt() and 0xFF
                offset += 1
                if (remaining - 1 < lc) throw IllegalArgumentException("APDU Lc exceeds length")
                if (lc > 0) {
                    data = apdu.copyOfRange(offset, offset + lc)
                    offset += lc
                } else {
                    data = ByteArray(0)
                }
                if (apdu.size > offset) {
                    le = apdu[offset].toInt() and 0xFF
                }
            }
        }
        return Apdu(cla, ins, p1, p2, lc, data, le)
    }
}