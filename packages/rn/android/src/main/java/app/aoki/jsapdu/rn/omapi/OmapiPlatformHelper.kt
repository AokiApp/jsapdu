package app.aoki.jsapdu.rn.omapi

import android.content.Context
import android.se.omapi.SEService
import app.aoki.jsapdu.rn.SmartCardPlatform
import app.aoki.jsapdu.rn.core.IDevice
import com.margelo.nitro.aokiapp.jsapdurn.D2CProtocol
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.P2DProtocol

/**
 * OMAPI-specific platform helper for device enumeration and creation.
 * Isolates OMAPI logic from the main SmartCardPlatform.
 */
@androidx.annotation.RequiresApi(android.os.Build.VERSION_CODES.P)
object OmapiPlatformHelper {

  /**
   * Get device info for available OMAPI devices.
   */
  fun getDeviceInfo(service: SEService?, connected: Boolean): List<DeviceInfo> {
    if (!connected || service == null) {
      return emptyList()
    }

    return try {
      val readers = service.readers
      readers.mapIndexed { index, reader ->
        val readerName = reader.name
        val deviceType = classifyReaderType(readerName)

        DeviceInfo(
          id = "omapi-$deviceType-$index",
          devicePath = readerName,
          friendlyName = "$deviceType Secure Element",
          description = "OMAPI: $readerName",
          supportsApdu = true,
          isIntegratedDevice = deviceType == "eSE",
          isRemovableDevice = deviceType == "SIM",
          d2cProtocol = D2CProtocol.NFC,
          p2dProtocol = P2DProtocol.NFC,
          apduApi = arrayOf("omapi", "androidse"),
          antennaInfo = null
        )
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  /**
   * Create an OMAPI device instance.
   * @throws IllegalStateException if OMAPI is not available
   * @throws IllegalArgumentException if device ID is invalid
   */
  fun createDevice(
    platform: SmartCardPlatform,
    context: Context,
    service: SEService?,
    connected: Boolean,
    deviceId: String
  ): IDevice {
    val seService = service
      ?: throw IllegalStateException("PLATFORM_ERROR: OMAPI not supported")

    if (!connected) {
      throw IllegalStateException("PLATFORM_ERROR: SEService not connected")
    }

    // Find the reader by matching device ID with reader info
    val readers = seService.readers
    val matchingReader = readers.firstOrNull { reader ->
      val readerName = reader.name
      val deviceType = classifyReaderType(readerName)
      val index = readers.indexOf(reader)
      "omapi-$deviceType-$index" == deviceId
    }

    if (matchingReader == null) {
      throw IllegalArgumentException("INVALID_DEVICE_ID: No such OMAPI device with ID '$deviceId'")
    }

    return OmapiDevice(platform, context, deviceId, matchingReader.name)
  }

  /**
   * Classify reader type based on reader name.
   */
  private fun classifyReaderType(readerName: String): String {
    return when {
      readerName.contains("eSE", ignoreCase = true) -> "eSE"
      readerName.contains("SIM", ignoreCase = true) -> "SIM"
      readerName.contains("SD", ignoreCase = true) -> "SD"
      else -> "SE"
    }
  }

  /**
   * Get OMAPI state as string.
   */
  fun getStateString(connected: Boolean): String {
    return if (connected) "available" else "unavailable"
  }
}
