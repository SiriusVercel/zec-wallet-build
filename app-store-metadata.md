# Zcash Wallet — App Store Submission Checklist

## Basic Info
- **App Name:** Zcash Wallet
- **Subtitle:** Private & Shielded ZCash (max 30 chars: 27 ✓)
- **Bundle ID:** com.zecwallet.app
- **SKU:** ZECWALLET001
- **Primary Category:** Finance
- **Secondary Category:** Utilities
- **Age Rating:** 17+
- **Price:** Free

## App Store Description (4000 chars max)

Zcash Wallet is the most private way to send and receive ZEC on iPhone. Built from the ground up with financial privacy as the first priority.

**True Privacy by Default**
Every transaction uses Zcash's Orchard shielded protocol — the most advanced zero-knowledge proof system available in any consumer crypto wallet. Transaction amounts, addresses, and memos are encrypted on-chain.

**Your Keys, Your ZEC**
Non-custodial by design. Your 24-word recovery phrase never leaves your device. It is stored in iOS Keychain, protected by Face ID / Touch ID, and encrypted at the hardware level. We have zero access to your funds.

**No Account Required**
No email address. No password. No identity verification. Just install, generate a wallet, and start transacting with complete financial privacy.

**Features**
• Generate a new wallet with a cryptographically secure 24-word recovery phrase
• Restore any existing Zcash wallet with your recovery phrase
• Backup verification quiz to ensure you have saved your phrase correctly
• Face ID / Touch ID biometric lock for maximum security
• Real-time ZEC/USD price charts powered by Kraken exchange
• Transaction history with sent/received flow insights
• QR code display for fast address sharing
• Native iOS Share sheet integration
• Shielded address (Orchard pool) with transparent fallback
• Background blockchain sync with progress indicator
• Available in 20 languages: English, Português, Español, Français, Deutsch, Italiano, 中文, 日本語, 한국어, Русский, العربية, हिन्दी, Türkçe, Nederlands, Polski, Svenska, Українська, Bahasa Indonesia, Tiếng Việt, ภาษาไทย

**What Is Zcash?**
Zcash (ZEC) is a leading privacy-focused cryptocurrency. Unlike Bitcoin, Zcash uses zero-knowledge proofs to shield transaction details from public view while maintaining full blockchain security.

## Keywords (100 chars max)
zcash,zec,privacy wallet,crypto,shielded,private,anonymous,bitcoin,defi,finance

## Privacy Policy URL
https://zecwallet.app/privacy

## Support URL
https://zecwallet.app/support

## Marketing URL
https://zecwallet.app

## Screenshots Required
### 6.7" iPhone (1290 × 2796 px) — 3 minimum, 10 max
1. Onboarding: "Private Money, Free People"
2. Home: Balance card + action buttons
3. Send: Transaction review screen
4. Receive: QR code screen
5. Price chart: ZEC/USD with period selector

### 6.1" iPhone (1179 × 2556 px) — 3 minimum
(Same screens as above)

## App Review Notes
- This is a non-custodial Zcash cryptocurrency wallet
- No account or login required — purely on-device
- Network requests go to: api.zecwallet.app (our relay), na.zec.rocks (Zcash lightwalletd), api.kraken.com (price feed)
- The app does not include any real money transactions within the app itself — it broadcasts to the Zcash blockchain
- Face ID is used only for local biometric lock, not for any remote authentication

## EAS Build Command
```
eas build --platform ios --profile production
```

## EAS Submit Command
```
eas submit --platform ios --latest
```
