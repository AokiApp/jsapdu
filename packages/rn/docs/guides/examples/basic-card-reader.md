# 基本的なNFCカード読み取りアプリの実装指針

## 📱 実装すべき機能概要

NFCカードをタッチしてATRやカード情報を表示するシンプルなReact Nativeアプリの実装指針

### 必要なコンポーネント設計

**状態管理:**
- 初期化状態 (isInitialized)
- 読み取り中状態 (isReading)
- カード履歴 (cardHistory)
- デバイス情報 (deviceInfo)

**主要機能:**
- NFC初期化処理
- デバイス情報表示
- カード読み取り実行
- ATR取得・表示
- エラーハンドリング
- 履歴管理

### 実装すべきライフサイクル

**1. 初期化フェーズ:**
- useEffect で SmartCardPlatform.init()
- デバイス情報取得・表示
- エラー処理

**2. カード読み取りフェーズ:**
- デバイス取得 (acquireDevice)
- カード待機 (waitForCardPresence)
- セッション開始 (startSession)
- ATR取得 (getAtr)
- オプション: 基本APDU送信

**3. クリーンアップフェーズ:**
- カード解放 (card.release)
- デバイス解放 (device.release)
- プラットフォーム解放 (platform.release)

### UI設計指針

**画面構成:**
- タイトル表示
- デバイス情報セクション
- 操作ボタン（読み取り開始）
- 読み取り履歴表示

**UX考慮事項:**
- ローディング状態表示
- 適切なエラーメッセージ
- 履歴の見やすい表示
- タイムアウト処理

## 🔧 カスタマイズ例

### 特定のカード種別の検出

```typescript
// ATRに基づくカード種別判定
const identifyCardType = (atr: ArrayBuffer): string => {
  const atrBytes = new Uint8Array(atr);
  const atrHex = Array.from(atrBytes).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  
  // 一般的なカード種別の判定例
  if (atrHex.includes('4a434f50')) {
    return 'JCOP カード';
  } else if (atrHex.includes('504b4353')) {
    return 'PKCSカード';
  } else if (atrBytes[0] === 0x3b && atrBytes[1] === 0x68) {
    return 'Mifare Classic互換';
  } else {
    return '不明なカード';
  }
};

// 使用例
const card = await device.startSession();
const atr = await card.getAtr();
const cardType = identifyCardType(atr);
console.log('検出されたカード:', cardType);
```

### エラーハンドリングの強化

```typescript
const robustCardReading = async () => {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`読み取り試行 ${attempt}/${maxRetries}`);
      
      const device = await SmartCardPlatform.acquireDevice(deviceInfo[0].id);
      await device.waitForCardPresence(15000);
      const card = await device.startSession();
      
      // 成功時の処理
      const atr = await card.getAtr();
      return { success: true, atr };
      
    } catch (error) {
      console.log(`試行 ${attempt} 失敗:`, error.message);
      
      if (attempt === maxRetries) {
        return { success: false, error: error.message };
      }
      
      // 再試行前の待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};
```

## 📚 参考情報

- **ATR解析**: ATR（Answer To Reset）の詳細な解析方法
- **ISO7816-4**: スマートカードの標準的な通信プロトコル
- **NFCフォーラム**: NFC技術の公式仕様

このサンプルを基に、より複雑なスマートカードアプリケーションを構築できます。