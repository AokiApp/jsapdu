import { hexStringToUint8Array } from "@aokiapp/interface/utils";

export const kenkakuEntries = hexStringToUint8Array(
  process.env.KENKAKU_02 || "",
);

export const kenkakuInformation = hexStringToUint8Array(
  process.env.KENKAKU_03 || "",
);

export const kenkakuCertificate = hexStringToUint8Array(
  process.env.KENKAKU_04 || "",
);

export const kenkakuMyNumber = hexStringToUint8Array(
  process.env.KENKAKU_05 || "",
);

export const kenhojoMyNumber = hexStringToUint8Array(
  process.env.KENHOJO_01 || "",
);

export const kenhojoBasicFour = hexStringToUint8Array(
  process.env.KENHOJO_02 || "",
);

export const kenhojoSignature = hexStringToUint8Array(
  process.env.KENHOJO_03 || "",
);

export const kenhojoCertificate = hexStringToUint8Array(
  process.env.KENHOJO_04 || "",
);

export const kenhojoInformation = hexStringToUint8Array(
  process.env.KENHOJO_05 || "",
);

export const kenhojoEf0006 = hexStringToUint8Array(
  process.env.KENHOJO_06 || "",
);

export const kenhojoAuthKey = hexStringToUint8Array(
  process.env.KENHOJO_07 || "",
);
