/**
 * 公的個人認証 (JPKI) AP (`D392F000260100000001`)
 */
export const JPKI_AP = [
  0xd3, 0x92, 0xf0, 0x00, 0x26, 0x01, 0x00, 0x00, 0x00, 0x01,
];
export const JPKI_AP_EF = {
  /** 署名用電子証明書 */
  SIGN_CERT: 0x01,
  /** 署名用電子証明書CA */
  SIGN_CERT_CA: 0x02,
  UNKNOWN_05: 0x05,
  JPKI_AP_TOKEN: 0x06,
  UNKNOWN_08: 0x08,
  UNKNOWN_09: 0x09,
  /** 利用者証明用電子証明書 */
  AUTH_CERT: 0x0a,
  /** 利用者証明用電子証明書CA */
  AUTH_CERT_CA: 0x0b,
  UNKNOWN_10: 0x10,
  UNKNOWN_16: 0x16,
  /** 利用者証明用電子証明書秘密鍵 */
  AUTH_KEY: 0x17,
  /** 利用者証明用電子証明書暗証番号 */
  AUTH_PIN: 0x18,
  UNKNOWN_19: 0x19,
  /** 署名用電子証明書秘密鍵 */
  SIGN_KEY: 0x1a,
  /** 署名用電子証明書暗証番号 */
  SIGN_PIN: 0x1b,
  UNKNOWN_1C: 0x1c,
  UNKNOWN_1E: 0x1e,
} as const;

/**
 * 券面事項確認AP (`D3921000310001010402`)
 */
export const KENKAKU_AP = [
  0xd3, 0x92, 0x10, 0x00, 0x31, 0x00, 0x01, 0x01, 0x04, 0x02,
];
export const KENKAKU_AP_EF = {
  /** 生年月日 */
  BIRTH: 0x01,
  /** 券面事項 */
  ENTRIES: 0x02,
  /** AP基本情報 */
  INFORMATION: 0x03,
  /** 中間証明書 */
  INTERMEDIATE_CERTIFICATE: 0x04,
  /** 個人番号 */
  MY_NUMBER: 0x05,
  UNKNOWN_06: 0x06,
  BIRTH_PIN: 0x11,
  /** 照合番号B (券面事項14桁, YYMMDD + 有効期限年 + セキュリティコード) */
  PIN_B: 0x12,
  /** 照合番号A (個人番号12桁) */
  PIN_A: 0x13,
  UNKNOWN_1A: 0x1a,
  UNKNOWN_1C: 0x1c,
  UNKNOWN_1E: 0x1e,
} as const;

/**
 * 券面事項入力補助AP (`D3921000310001010408`)
 */
export const KENHOJO_AP = [
  0xd3, 0x92, 0x10, 0x00, 0x31, 0x00, 0x01, 0x01, 0x04, 0x08,
];
export const KENHOJO_AP_EF = {
  /** 個人番号 (保護) */
  MY_NUMBER: 0x01,
  /** 券面4事項 (保護) */
  BASIC_FOUR: 0x02,
  /** 個人番号と券面事項のハッシュ (保護) */
  SIGNATURE: 0x03,
  /** 中間証明書 */
  INTERMEDIATE_CERTIFICATE: 0x04,
  /** AP基本情報 */
  INFORMATION: 0x05,
  /** 不明な鍵 (保護) */
  UNKNOWN_06: 0x06,
  /** 認証鍵 (保護) */
  AUTH_KEY: 0x07,
  UNKNOWN_08: 0x08,
  UNKNOWN_10: 0x10,
  /** 券面事項入力補助用暗証番号 (4桁) */
  PIN: 0x11,
  UNKNOWN_12: 0x12,
  UNKNOWN_13: 0x13,
  /** 照合番号A (個人番号12桁) */
  PIN_A: 0x14,
  /** 照合番号B (券面事項14桁, YYMMDD + 有効期限年 + セキュリティコード) */
  PIN_B: 0x15,
  UNKNOWN_1C: 0x1c,
  UNKNOWN_1E: 0x1e,
} as const;
