// Type definitions for parsed schema results.
// These are manually defined because @aokiapp/tlv doesn't export its schema types.

export interface CertificateParsed {
  contents: {
    issuer: ArrayBuffer;
    subject: ArrayBuffer;
    publicKeyRaw: ArrayBuffer;
  };
  thisSignature: Uint8Array;
}

export interface KenhojoBasicFourParsed {
  offsets: number[];
  name: string;
  address: string;
  birth: string;
  gender: string;
}

export interface KenhojoSignatureParsed {
  kenhojoMyNumberHash: Uint8Array;
  kenhojoBasicFourHash: Uint8Array;
  thisSignature: Uint8Array;
}

export interface KenhojoAuthKeyParsed {
  publicKeyRaw: ArrayBuffer;
  thisSignature: Uint8Array;
}

export interface KenkakuBirthParsed {
  birth: string;
  publicKeyRaw: ArrayBuffer;
  thisSignature: Uint8Array;
}

export interface KenkakuEntriesParsed {
  offsets: number[];
  birth: string;
  gender: string;
  publicKeyRaw: ArrayBuffer;
  namePng: Uint8Array;
  addressPng: Uint8Array;
  faceJp2: Uint8Array;
  thisSignature: Uint8Array;
  expire: string;
  securityCodePng: Uint8Array;
}

export interface KenkakuMyNumberParsed {
  myNumberPng: Uint8Array;
  publicKeyRaw: ArrayBuffer;
  thisSignature: Uint8Array;
}
