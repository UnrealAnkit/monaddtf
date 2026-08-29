# Alloy — a single-deposit index vault for the Monad ecosystem

**Live on Monad testnet** — deployed, minted, and redeemed for real. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for contract addresses and
on-chain transaction links.

One token that holds a weighted basket of Monad ecosystem assets. Deposit once,
mint a diversified position in one transaction; redeem pro-rata for the
underlying assets any time — redemption can never be paused.

> **Alloy** *(n.)* — a metal formed by melting two or more elements together.
> Same idea here: several ecosystem tokens, melted into one.

## The problem

Getting diversified exposure to a fast-growing chain's ecosystem today means
either picking individual tokens yourself (research overhead, no rebalancing,
you end up over-indexed on whatever you bought first) or trusting a
centralized index product (custody risk, opaque rebalancing, withdrawal
gates). Neither is great, and on most chains a fully on-chain basket product
is a bad trade-off anyway: every deposit needs several swaps plus an oracle
read, and on a slow or expensive chain that's either too costly for a small
depositor or too slow to execute atomically before prices move.

## Why this works on Monad specifically

Monad's ~1s block time, single-slot finality, and sub-cent gas make "swap
into N assets and mint a share token, atomically, in one transaction" cheap
enough to be practical for everyday deposit sizes — not just whales. That's
the whole product: it's a straightforward vault, but the chain is what makes
it worth using instead of just buying the five tokens yourself.

## How it works

1. **Deposit** a single entry asset (e.g. wrapped MON).
2. The vault **splits** your deposit by each basket asset's target weight and
   swaps each portion through a DEX router, atomically, in one transaction.
3. You receive **shares** proportional to the USD value actually added,
   priced through an on-chain oracle router.
4. **Redeem** any time by burning shares for your pro-rata slice of every
   asset the vault holds — no swap needed, so this path is never pausable.

```
deposit (mMON)
   │
   ├─ 40% ──▶ swap ──▶ mGOV     ┐
   ├─ 40% ──▶ swap ──▶ mLSMON   ├─▶ mint shares (Alloy Demo Index)
   └─ 20% ──▶ swap ──▶ mUSD     ┘
```

## Key invariants

- **Baskets are immutable.** Target weights are fixed at deployment; a new
  strategy or reweighting ships as a new vault via the factory, so a holder
  always knows exactly what their share represents.
- **Rounding always favors the vault** — both share issuance on mint and
  asset payout on redeem floor-divide, so dust accrues to remaining holders
  instead of leaking value out on every transaction.
- **Mint can be paused; redemption never can.** A guardian can halt new
  deposits (e.g. if a price feed misbehaves), but getting your assets back
  is a contract guarantee, not a permission.
- **Oracle prices are used for slippage bounds and NAV display, not to
  gate redemption** — you always get your pro-rata share of whatever the
  vault actually holds.

## Layout

```
contracts/
  core/       IndexVault (the basket + ERC20 share token), IndexFactory
  oracle/     OracleRouter — per-asset Chainlink-compatible feed routing,
              staleness checks, 1e18 USD normalization
  interfaces/ IPriceOracle, IChainlinkFeed, ISwapRouter
  mocks/      MockERC20, MockPriceFeed, MockSwapRouter — testnet/test only,
              never deploy these to mainnet
test/         Hardhat + TypeScript test suite
scripts/      deploy.ts — bootstraps a demo index (local or Monad testnet),
              smoke-test.ts — exercises a live mint + redeem cycle
app/          Next.js frontend — landing page + wallet-connected dashboard
```

## Build & test

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Deploy a demo index

```bash
npm run deploy:local      # local Hardhat node, chain 31337
npm run deploy:testnet    # real Monad testnet, chain 10143 — needs DEPLOYER_KEY in .env
```

This deploys mock ERC20s standing in for ecosystem assets, a mock price feed
per asset, and a mock swap router, then bootstraps one demo `IndexVault`
through the factory. Addresses land in `deployments/<network>.json` and are
copied into `app/lib/deployments/<network>.json` for the frontend to read.

**Before a real deployment:** swap `MockPriceFeed` for real feed addresses
(Pyth, Chainlink, Chronicle, Supra, or Switchboard all publish Monad feeds —
see [Monad's oracle docs](https://docs.monad.xyz/tooling-and-infra/oracles))
and `MockSwapRouter` for a real router address (Uniswap or Kuru are both live
on Monad testnet). The vault's `ISwapRouter` interface matches the standard
Uniswap V2 router surface, so either drops in without a contract change.

## Frontend

Next.js app in `app/` — a landing page (live NAV/TVL/basket data, no wallet
needed) plus a `/app` dashboard (connect a wallet, mint, redeem, faucet).

```bash
cd app
npm install
npm run dev      # http://localhost:3000
```

Defaults to the live Monad testnet deployment. To point it at a local
`deploy:local` deployment instead, set in `app/.env.local`:

```
NEXT_PUBLIC_ALLOY_NETWORK=localhost
```

## Network info (Monad testnet)

| | |
|---|---|
| Chain ID | `10143` |
| RPC | `https://rpc.testnet.monad.xyz` |
| Explorer | `https://testnet.monadexplorer.com` |
| Native currency | `MON` |
