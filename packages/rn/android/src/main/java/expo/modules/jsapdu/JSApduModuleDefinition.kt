package expo.modules.jsapdu

import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Module definition for JSApdu
 * This is used by Expo to register the module
 */
class JSApduModuleDefinition : ModuleDefinition {
  override fun definition() = ModuleDefinition {
    // Set the module name that will be used in JavaScript
    Name("JSApduModule")

    // Constants that will be exported to JavaScript
    Constants(
      "PLATFORM_NAME" to "Android NFC",
      "PLATFORM_VERSION" to "1.0.0"
    )

    // Create a platform manager instance
    AsyncFunction("createPlatformManager") {
      return@AsyncFunction AndroidPlatformManagerImpl.receiverId
    }

    // Initialize the platform
    AsyncFunction("initPlatform") { receiverId: String ->
      val manager = ObjectRegistry.getObject<AndroidPlatformManagerImpl>(receiverId)
      manager.init()
      return@AsyncFunction null
    }

    // Release the platform
    AsyncFunction("releasePlatform") { receiverId: String ->
      val manager = ObjectRegistry.getObject<AndroidPlatformManagerImpl>(receiverId)
      manager.release()
      return@AsyncFunction null
    }

    // Get devices
    AsyncFunction("getDevices") { receiverId: String ->
      val manager = ObjectRegistry.getObject<AndroidPlatformManagerImpl>(receiverId)
      val platform = manager.getPlatform()
      val devices = platform.getDevices()
      
      // Convert devices to a list of device info objects with receiver IDs
      return@AsyncFunction devices.map { deviceInfo ->
        mapOf(
          "receiverId" to deviceInfo.receiverId,
          "id" to deviceInfo.id,
          "devicePath" to deviceInfo.devicePath,
          "friendlyName" to deviceInfo.friendlyName,
          "description" to deviceInfo.description,
          "supportsApdu" to deviceInfo.supportsApdu,
          "supportsHce" to deviceInfo.supportsHce,
          "isIntegratedDevice" to deviceInfo.isIntegratedDevice,
          "isRemovableDevice" to deviceInfo.isRemovableDevice,
          "d2cProtocol" to deviceInfo.d2cProtocol,
          "p2dProtocol" to deviceInfo.p2dProtocol,
          "apduApi" to deviceInfo.apduApi
        )
      }
    }

    // Acquire device
    AsyncFunction("acquireDevice") { receiverId: String ->
      val deviceInfo = ObjectRegistry.getObject<AndroidDeviceInfoImpl>(receiverId)
      val device = deviceInfo.acquireDevice()
      return@AsyncFunction device.receiverId
    }

    // Check if card is present
    Function("isCardPresent") { receiverId: String ->
      val device = ObjectRegistry.getObject<AndroidDeviceImpl>(receiverId)
      return@Function device.isCardPresent()
    }

    // Start session
    Function("startSession") { receiverId: String ->
      val device = ObjectRegistry.getObject<AndroidDeviceImpl>(receiverId)
      val card = device.startSession()
      return@Function card.receiverId
    }

    // Start HCE session
    Function("startHceSession") { receiverId: String ->
      val device = ObjectRegistry.getObject<AndroidDeviceImpl>(receiverId)
      val card = device.startHceSession()
      return@Function card.receiverId
    }

    // Release device
    Function("releaseDevice") { receiverId: String ->
      val device = ObjectRegistry.getObject<AndroidDeviceImpl>(receiverId)
      device.release()
      return@Function null
    }

    // Get ATR (synchronous, since getAtr is now sync)
    Function("getAtr") { receiverId: String ->
      val card = ObjectRegistry.getObject<AndroidSmartCardImpl>(receiverId)
      return@Function card.getAtr()
    }

    // Transmit APDU
    // Transmit APDU (Coroutine mode)
    AsyncFunction("transmit") Coroutine { receiverId: String, apdu: List<Int> ->
      val card = ObjectRegistry.getObject<AndroidSmartCardImpl>(receiverId)
      val response = card.transmit(CommandApdu(apdu.map { it.toByte() }.toByteArray()))
      return@Coroutine response.bytes.map { it.toInt() and 0xFF }
    }
    // Reset card
    // Reset card (Coroutine mode)
    AsyncFunction("resetCard") Coroutine { receiverId: String ->
      val card = ObjectRegistry.getObject<AndroidSmartCardImpl>(receiverId)
      card.reset()
      return@Coroutine null
    }
    // Release card (Coroutine mode)
    AsyncFunction("releaseCard") Coroutine { receiverId: String ->
      val card = ObjectRegistry.getObject<AndroidSmartCardImpl>(receiverId)
      card.release()
      return@Coroutine null
    }

    // Create APDU handler
    AsyncFunction("createApduHandler") { handler: (List<Int>) -> List<Int> ->
      val apduHandler = object : ApduHandler {
        override fun handleApdu(apdu: ByteArray): ByteArray {
          val result = handler(apdu.map { it.toInt() and 0xFF })
          return result.map { it.toByte() }.toByteArray()
        }
      }
      return@AsyncFunction ObjectRegistry.register(apduHandler)
    }

    // Create state change handler
    AsyncFunction("createStateChangeHandler") { handler: (String) -> Unit ->
      val stateChangeHandler = object : StateChangeHandler {
        override fun handleStateChange(state: String) {
          handler(state)
        }
      }
      return@AsyncFunction ObjectRegistry.register(stateChangeHandler)
    }

    // Set APDU handler for HCE
    Function("setApduHandler") { receiverId: String, handlerId: String ->
      val card = ObjectRegistry.getObject<AndroidEmulatedCardImpl>(receiverId)
      val handler = ObjectRegistry.getObject<ApduHandler>(handlerId)
      card.setApduHandler(handler::handleApdu)
      return@Function null
    }

    // Set state change handler for HCE
    Function("setStateChangeHandler") { receiverId: String, handlerId: String ->
      val card = ObjectRegistry.getObject<AndroidEmulatedCardImpl>(receiverId)
      val handler = ObjectRegistry.getObject<StateChangeHandler>(handlerId)
      card.setStateChangeHandler(handler::handleStateChange)
      return@Function null
    }

    // Release emulated card
    AsyncFunction("releaseEmulatedCard") Coroutine { receiverId: String ->
      val card = ObjectRegistry.getObject<AndroidEmulatedCardImpl>(receiverId)
      card.release()
      return@Coroutine null
    }
  }
}