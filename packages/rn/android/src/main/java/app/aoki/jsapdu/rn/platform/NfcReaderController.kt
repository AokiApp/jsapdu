package app.aoki.jsapdu.rn.platform

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle

/**
 * ReaderMode controller (internal).
 * - Fixed flags: NFC_A | NFC_B | NFC_F | SKIP_NDEF
 * - Filters to ISO-DEP and notifies listener.
 * - Does not expose Android types to FFI boundary.
 */
object NfcReaderController : NfcAdapter.ReaderCallback {

  interface Listener {
    fun onIsoDep(deviceHandle: String, isoDep: IsoDep)
    fun onTagLost(deviceHandle: String)
  }

  private var listener: Listener? = null
  private var deviceHandle: String? = null

  fun enable(activity: Activity, deviceHandle: String, listener: Listener) {
    val adapter = NfcAdapter.getDefaultAdapter(activity)
        ?: throw UnsupportedOperationException("NFC not supported")
    this.listener = listener
    this.deviceHandle = deviceHandle
    val flags = (NfcAdapter.FLAG_READER_NFC_A
        or NfcAdapter.FLAG_READER_NFC_B
        or NfcAdapter.FLAG_READER_NFC_F
        or NfcAdapter.FLAG_READER_SKIP_NDEF)
    adapter.enableReaderMode(activity, this, flags, Bundle())
  }

  fun disable(activity: Activity) {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return
    adapter.disableReaderMode(activity)
    deviceHandle?.let { handle ->
      listener?.onTagLost(handle)
    }
    listener = null
    deviceHandle = null
  }

  override fun onTagDiscovered(tag: Tag) {
    val isoDep = IsoDep.get(tag) ?: return
    val handle = deviceHandle ?: return
    try {
      // Set a reasonable default I/O timeout (ms)
      isoDep.timeout = 5000
    } catch (_: Throwable) {
      // TODO: handle or log exception
    }
    listener?.onIsoDep(handle, isoDep)
  }
}