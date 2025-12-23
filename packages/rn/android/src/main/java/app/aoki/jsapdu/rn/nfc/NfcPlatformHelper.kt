package app.aoki.jsapdu.rn.nfc

import android.nfc.NfcAdapter
import android.nfc.NfcAntennaInfo as FrameworkNfcAntennaInfo
import android.os.Build
import android.util.Log
import app.aoki.jsapdu.rn.SmartCardPlatform
import app.aoki.jsapdu.rn.core.IDevice
import com.margelo.nitro.aokiapp.jsapdurn.D2CProtocol
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.NfcAntenna
import com.margelo.nitro.aokiapp.jsapdurn.NfcAntennaInfo
import com.margelo.nitro.aokiapp.jsapdurn.NfcDeviceSize
import com.margelo.nitro.aokiapp.jsapdurn.NfcFormFactor
import com.margelo.nitro.aokiapp.jsapdurn.P2DProtocol

/**
 * NFC-specific platform helper for device enumeration and creation.
 * Isolates NFC logic from the main SmartCardPlatform.
 */
object NfcPlatformHelper {

  /**
   * Get device info for available NFC devices.
   */
  fun getDeviceInfo(adapter: NfcAdapter?): List<DeviceInfo> {
    if (adapter == null || !adapter.isEnabled) {
      return emptyList()
    }

    // 実デバイスのアンテナ情報をAndroidフレームワークから取得し、JS向け構造にマッピング
    val antennaInfo = resolveAntennaInfo(adapter)

    return listOf(
      DeviceInfo(
        id = "integrated-nfc-0",
        devicePath = null,
        friendlyName = "Integrated NFC Reader",
        description = "Android NFC with ISO-DEP support",
        supportsApdu = true,
        isIntegratedDevice = true,
        isRemovableDevice = false,
        d2cProtocol = D2CProtocol.NFC,
        p2dProtocol = P2DProtocol.NFC,
        apduApi = arrayOf("nfc", "androidnfc"),
        antennaInfo = antennaInfo
      )
    )
  }

  private fun resolveAntennaInfo(adapter: NfcAdapter): NfcAntennaInfo? {
    // Android 14 (API 34) 以降でのみNfcAntennaInfoが提供される想定
    if (Build.VERSION.SDK_INT < 34) {
      return null
    }

    return try {
      // frameworkの android.nfc.NfcAntennaInfo を取得
      val fwInfo: FrameworkNfcAntennaInfo = adapter.nfcAntennaInfo ?: return null

      // Log the framework antenna info for debugging
      Log.d(
        "NfcPlatformHelper",
        "Framework NfcAntennaInfo: ${fwInfo.deviceWidth} x ${fwInfo.deviceHeight}, antennas: ${fwInfo.availableNfcAntennas.size}, foldable: ${fwInfo.isDeviceFoldable}"
      )

      val deviceSize = NfcDeviceSize(
        width = fwInfo.deviceWidth.toDouble(),
        height = fwInfo.deviceHeight.toDouble()
      )

      val antennasArray = fwInfo.availableNfcAntennas
        .map { antenna ->
          NfcAntenna(
            centerX = antenna.locationX.toDouble(),
            centerY = antenna.locationY.toDouble(),
            radius = null // Framework側には半径情報がないのでnull
          )
        }
        .toTypedArray()

      val formFactor = if (fwInfo.isDeviceFoldable) {
        // 折りたたみ端末かどうかしか分からないので、ざっくりBifoldに寄せる
        NfcFormFactor.BIFOLD
      } else {
        NfcFormFactor.PHONE
      }

      NfcAntennaInfo(
        deviceSize = deviceSize,
        antennas = antennasArray,
        formFactor = formFactor
      )
    } catch (_: Throwable) {
      null
    }
  }

  /**
   * Create an NFC device instance.
   * @throws IllegalStateException if NFC is not available or device ID is invalid
   */
  fun createDevice(platform: SmartCardPlatform, adapter: NfcAdapter?, deviceId: String): IDevice {
    val nfcAdapter = adapter
      ?: throw IllegalStateException("PLATFORM_ERROR: NFC not supported")

    if (!nfcAdapter.isEnabled) {
      throw IllegalStateException("PLATFORM_ERROR: NFC is disabled in system settings")
    }

    if (deviceId != "integrated-nfc-0") {
      throw IllegalArgumentException("INVALID_DEVICE_ID: No such NFC device with ID '$deviceId'")
    }

    return NfcDevice(platform, nfcAdapter, id = deviceId)
  }

  /**
   * Get NFC state as string.
   */
  fun getStateString(adapter: NfcAdapter?): String {
    return when {
      adapter == null -> "unavailable"
      adapter.isEnabled -> "on"
      else -> "off"
    }
  }
}
