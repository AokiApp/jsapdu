import { PcscPlatformManager } from "@aokiapp/pcsc";

export async function getPlatform() {
  const plat = PcscPlatformManager.getInstance().getPlatform();
  if (!plat.isInitialized()) {
    await plat.init();
  }
  return plat;
}
