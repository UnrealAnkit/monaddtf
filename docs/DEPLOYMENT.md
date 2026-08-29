# Live deployment — Monad testnet

Deployed and verified working (mint + redeem both exercised on-chain) on
2026-08-29.

| Contract | Address |
|---|---|
| `IndexFactory` | [`0x4a06c7B07D0Ee0E163d26e6ebaFbE0E2CAa5E358`](https://testnet.monadexplorer.com/address/0x4a06c7B07D0Ee0E163d26e6ebaFbE0E2CAa5E358) |
| `IndexVault` (Demo Ecosystem Index, DEMO) | [`0x77271B49Eb51a2B1c9c768f4EAB316bD3f832D56`](https://testnet.monadexplorer.com/address/0x77271B49Eb51a2B1c9c768f4EAB316bD3f832D56) |
| `OracleRouter` | [`0x3b5aFf6988cF5a908AD141A666BC30D491011463`](https://testnet.monadexplorer.com/address/0x3b5aFf6988cF5a908AD141A666BC30D491011463) |
| `MockSwapRouter` | [`0x5ED9960a7E71359393C700A6F1684109753448aE`](https://testnet.monadexplorer.com/address/0x5ED9960a7E71359393C700A6F1684109753448aE) |
| Entry asset — `mMON` | [`0x56b16A3D35D9dC84B195342eF40767A5969c563E`](https://testnet.monadexplorer.com/address/0x56b16A3D35D9dC84B195342eF40767A5969c563E) |
| Basket — `mGOV` (40%) | [`0x9c3657D1B249622D15381B543f550Dee0c1CC362`](https://testnet.monadexplorer.com/address/0x9c3657D1B249622D15381B543f550Dee0c1CC362) |
| Basket — `mLSMON` (40%) | [`0xCD9147797430286F5d5C9512AD5Fbb55aABd6138`](https://testnet.monadexplorer.com/address/0xCD9147797430286F5d5C9512AD5Fbb55aABd6138) |
| Basket — `mUSD` (20%) | [`0x8F2938Bc8795401c9F1537fab363325511538587`](https://testnet.monadexplorer.com/address/0x8F2938Bc8795401c9F1537fab363325511538587) |

Full JSON: [`app/lib/deployments/monadTestnet.json`](../app/lib/deployments/monadTestnet.json)

## Proof of a live mint + redeem cycle

Run via `scripts/smoke-test.ts` against `--network monadTestnet`:

- **Mint**: [`0xbffaf4ba173b7d8ea007870893db7883c5fb5fe3e6499e3af24b0bba3ddb5374`](https://testnet.monadexplorer.com/tx/0xbffaf4ba173b7d8ea007870893db7883c5fb5fe3e6499e3af24b0bba3ddb5374) — deposited 50 mMON and minted 49.85 DEMO shares.
- **Redeem**: [`0x1ec23d6a04b6f110ad7d013f8142fce667a1998a7b2ac8a8652d9f50ca188bd5`](https://testnet.monadexplorer.com/tx/0x1ec23d6a04b6f110ad7d013f8142fce667a1998a7b2ac8a8652d9f50ca188bd5) — burned half the shares and returned a pro-rata basket slice.

## Re-deploying

```bash
npm run deploy:testnet
```

Requires `DEPLOYER_KEY` in `.env` (a funded Monad testnet account — see
[faucet.monad.xyz](https://faucet.monad.xyz)). Writes fresh addresses to
`deployments/monadTestnet.json` and `app/lib/deployments/monadTestnet.json`.

## What's mocked vs. real

- **Real**: the chain (Monad testnet), the deployed contract bytecode, gas
  costs, and every transaction above.
- **Mocked**: the basket assets (`mGOV`/`mLSMON`/`mUSD`/`mMON`) are self-issued
  test tokens, not real Monad ecosystem tokens — there's no real market for
  them, so `MockPriceFeed` and `MockSwapRouter` stand in for a real oracle and
  DEX. Swapping in a real basket (e.g. WMON + a real DEX-listed governance
  token + a real LST) means pointing `OracleRouter.setFeed` at real Pyth/
  Chainlink feed addresses and `IndexVault`'s `swapRouter` at Uniswap's or
  Kuru's real router — no contract changes required, see the main
  [README](../README.md#deploy-a-demo-index).

The mock feeds in this deployment use a non-expiring staleness setting because
their values are deliberately static. Use a finite staleness window for every
live price feed.
