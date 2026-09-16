# network-wallet-core

> A fork of [XRPL-Commons/xrpl-connect](https://github.com/XRPL-Commons/xrpl-connect)
> that publishes something else: a facade for direct XRPL address and key management,
> balances, payments and trust lines, rather than the original wallet-connection toolkit.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)

## What this repo is

Upstream `xrpl-connect` is a wallet-*connection* toolkit: connect to a user's browser
extension or mobile wallet (Xaman, Crossmark, GemWallet, ...) and ask it to sign. This
fork keeps that machinery in the tree as internal implementation detail, but the
package this repository actually publishes,
**[`packages/xrpl-connect`](packages/xrpl-connect)**, published under the name
`@xrpl-lending-network/network-wallet-core` — is a different thing: a facade
for code that already holds a seed/private key (generated or imported) and wants to
derive addresses, read balances, and sign+submit transactions directly, with no browser
wallet in the loop.

## Install / connect

Install it and import from the package name. There is no client to construct and no
connection to open yourself:

```bash
npm install @xrpl-lending-network/network-wallet-core xrpl
```

`xrpl` is a peer dependency, so install it alongside. Inside this repository the same
package is available as a `workspace:*` dependency.

```typescript
import { Address, Accounts, Payments, TrustLines } from '@xrpl-lending-network/network-wallet-core';
```

Every method that talks to the network (`Accounts.*`, `Payments.*`, `TrustLines.*`)
opens its own connection and closes it when it resolves or rejects, defaulting to
**testnet** unless you pass `network: 'mainnet' | 'testnet' | 'devnet'` (or a custom
`NetworkInfo` with your own `wss` endpoint) as the last argument / a `network` field.

**→ [`examples/facade`](examples/facade)** is a working Vite app wiring every method
below to a UI form — clone it for a starting point, or `pnpm --filter facade-example run dev`
to click through them live.

## Usage examples

### `Address` — keys, no network

```typescript
// Generate a brand-new wallet (ed25519 by default)
const { address, publicKey, privateKey, seed } = Address.generate();
const secp = Address.generate('ecdsa-secp256k1');

// Restore a wallet you already have a secret for
Address.importBySeed('<SEED>');
Address.importByHex('<PRIVATE_KEY>');
Address.importByMnemonic('<MNEMONIC>');
Address.importByMnemonic(['<WORD_1>', '<WORD_2>', /* ...12/15/18/21/24 words */ '<WORD_12>']);
Address.importByXaman(['<SECRET_NUMBER_1>', '<SECRET_NUMBER_2>', /* ...8 groups */ '<SECRET_NUMBER_8>']);

// Validate before you import/sign — same rules the import methods themselves enforce
Address.isValidSeed(someUserInput); // true/false
Address.isValidHex('not-hex'); // false
Address.isValidMnemonic(someUserInput); // true/false, string or string[]
Address.isValidClassicAddress(someUserInput); // true/false
Address.isValidXamanGroup(someUserInput, 0); // one group, at its 0-indexed position
Address.isValidXamanSecretNumbers(someUserInput); // all 8 groups

// Generate demo/placeholder input for a form's "generate" button
Address.generateMnemonic(); // fresh random 12-word BIP-39 mnemonic
Address.generateXamanSecretNumbers(); // fresh random 8-group backup, checksums valid
```

### `Accounts` — read-only balance lookups

```typescript
const { drops, xrp } = await Accounts.getXrpBalance(address, 'testnet');

const tokens = await Accounts.getTokenBalances(address, 'testnet');
// [{ currency: 'FOO', issuer: '<ISSUER>', balance: '42' }, ...]

const mpts = await Accounts.getMptBalances(address, 'testnet');
// [{ mptIssuanceId: '<MPT_ISSUANCE_ID>', value: '500', locked?: '0' }, ...]
```

### `Payments` — sign and submit

```typescript
const credential = { seed }; // or { publicKey, privateKey } — whatever Address.* gave you

await Payments.sendXrp({
  credential,
  destination: '<DESTINATION>',
  amountXrp: '10', // XRP, not drops
  destinationTag: 12345, // optional
  network: 'testnet',
});

await Payments.sendToken({
  credential,
  destination: '<DESTINATION>',
  currency: 'FOO',
  issuer: '<ISSUER>',
  value: '42',
  network: 'testnet',
});

await Payments.sendMpt({
  credential,
  destination: '<DESTINATION>', // must already hold an authorized MPToken — see TrustLines.setMptTrustLine()
  mptIssuanceId: '<MPT_ISSUANCE_ID>',
  value: '500',
  network: 'testnet',
});
// All three resolve to { hash, engineResult, validated } — engineResult is 'tesSUCCESS'
// on success; an on-ledger failure (tecUNFUNDED_PAYMENT, tecNO_LINE, ...) is returned
// here, not thrown.
```

### `TrustLines` — issued-currency trust lines and the MPT equivalent

```typescript
const lines = await TrustLines.getTrustLines(address, 'testnet');
// [{ currency: 'FOO', issuer: '<ISSUER>', balance: '42', limit: '1000', limitPeer: '0' }, ...]

await TrustLines.setTokenTrustLine({
  credential,
  currency: 'FOO',
  issuer: '<ISSUER>',
  limit: '1000', // '0' resizes the line down to removed
  network: 'testnet',
});

await TrustLines.setMptTrustLine({
  credential,
  mptIssuanceId: '<MPT_ISSUANCE_ID>',
  authorize: true, // default; pass false to opt back out
  network: 'testnet',
});
```

**→ [Full API reference](packages/xrpl-connect/README.md)** — every method's exact
signature, the `SigningCredential`/network types, and the error-handling model.

## Repo layout

```
packages/
  xrpl-connect/         ← the facade — published as `@xrpl-lending-network/network-wallet-core`,
                           the only package meant to be imported externally
  core/                 ← internal: WalletManager, wallet-connection types (only
                           STANDARD_NETWORKS/resolveNetwork are reused by the facade)
  ui/                   ← internal: <xrpl-wallet-connector> web component
  react/, vue/           internal: framework bindings for the web component — these
                          still import the pre-facade API from '@xrpl-lending-network/network-wallet-core'
                          and currently fail to build; nothing in this repo depends on them
  adapters/*/            internal: Xaman/Crossmark/GemWallet/WalletConnect/Ledger/
                          Xyra/Otsu/MetaMask Snap wallet-connection adapters
examples/
  facade/                live demo of the facade (see above) — the only example in
                          this fork that reflects packages/xrpl-connect's current API
docs/                    original wallet-connection toolkit docs (WalletManager,
                          adapters, framework guides) — describes APIs that are no
                          longer part of packages/xrpl-connect's public surface
```

## Development

```bash
# Install dependencies
pnpm exec vp install

# Build all packages
pnpm exec vp run build

# Run tests
pnpm exec vp run test

# Lint
pnpm exec vp lint

# Format
pnpm exec vp fmt

# Development mode (watch)
pnpm exec vp run dev
```

Needs Node **`^20.19.0 || ^22.18.0 || >=24.11.0`** — `vp` fails on older Node 20.x
patch versions with an `ERR_UNKNOWN_FILE_EXTENSION` error. Check `node -v`; if you're on
`nvm`, `nvm use 20.19.5` (or newer) before running any `vp` command.

## License

MIT License — see the [LICENSE](./LICENSE) file for details.

## Upstream and attribution

This repository is a fork of
[XRPL-Commons/xrpl-connect](https://github.com/XRPL-Commons/xrpl-connect). The
wallet-connection code was written by XRPL Commons and its contributors and is used
here under the MIT licence; the copyright notice in [LICENSE](./LICENSE) is theirs.
`core/`, `ui/`, the framework bindings and all eight adapters are their work, unchanged.
The facade reaches into `core/` for two things only, `resolveNetwork` and
`STANDARD_NETWORKS`, so that network names resolve the same way here as they do for
the adapters.

What this fork adds is the facade itself, roughly 617 lines under
`packages/xrpl-connect/src`: `Address` with key generation and four import paths
(seed, hex, BIP-39 mnemonic, Xaman Secret Numbers) and a validator for each, plus
`Accounts`, `Payments` and `TrustLines`. `examples/facade` is new. Two upstream
examples were removed, `examples/react` and `examples/vanilla-js`, because they
demonstrate the connection API the published package no longer exposes.

Maintained by [XRPL Lending Network](https://github.com/XRPL-Lending-Network). Not
affiliated with, endorsed by, or maintained by XRPL Commons, the XRP Ledger
Foundation, or Ripple.

Upstream credits [RainbowKit](https://www.rainbowkit.com/),
[ConnectKit](https://github.com/family/connectkit) and
[Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) as inspiration
for its own design.
