package app.aoki.jsapdu.rn.nfc

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle

/**
 * Dedicated low-level NFC ReaderMode controller.
 * Encapsulates enable/disable of RF field via NfcAdapter ReaderMode.
 *
 * NOTE:
 * - This class is intentionally a regular class (not an object) to allow multiple instances
 *   if needed and to keep state encapsulated per controller.
 * - Tag lost handling is not provided by ReaderCallback directly; higher layers
 *   should manage lifecycle in conjunction with disable() calls.
 */
class NfcReaderController(private val adapter: NfcAdapter, private val onIsoDep: (IsoDep) -> Unit) {

  // Listener interface removed; using constructor-provided callback

  /**
   * Enable NFC ReaderMode with given flags and optional extras.
   * The listener is invoked for ISO-DEP capable tags.
   */
  fun enable(activity: Activity, flags: Int = DEFAULT_FLAGS, extras: Bundle? = null) {
    val options = (extras ?: Bundle()).apply {
      try {
        if (!containsKey(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY)) {
          // Speed up platform presence checks for quicker TagLost I/O failures
          putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 500)
        }
      } catch (_: Exception) { /* ignore option errors */ }
    }
    adapter.enableReaderMode(
      activity,
      NfcAdapter.ReaderCallback { tag: Tag? ->
        if (tag != null) {
          val isoDep = IsoDep.get(tag)
          if (isoDep != null) {
            try {
              // Set a reasonable default timeout for faster tag-loss detection on I/O
              try {
                isoDep.timeout = 5000
              } catch (_: Exception) {}
              onIsoDep(isoDep)
            } catch (_: Exception) {
              // Swallow callback exceptions to avoid crashing
            }
          }
        }
      },
      flags,
      options
    )
  }

  /**
   * Disable NFC ReaderMode on the provided Activity.
   */
  fun disable(activity: Activity) {
    adapter.disableReaderMode(activity)
  }

  companion object {
    // Typical flags: support NFC-A/NFC-B/NFC-F, skip NDEF and mute platform sounds
    const val DEFAULT_FLAGS: Int =
      NfcAdapter.FLAG_READER_NFC_A or
        NfcAdapter.FLAG_READER_NFC_B or
        NfcAdapter.FLAG_READER_NFC_F or
        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
        NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
  }
}
