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
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | `https://testnet.monadexplorer.com` |
| Native currency | `MON` |

## Table of contents

- [Product model](#product-model)
- [Repository layout](#repository-layout)
- [Prerequisites and installation](#prerequisites-and-installation)
- [Run locally](#run-locally)
- [Use the Monad testnet deployment](#use-the-monad-testnet-deployment)
- [Wallet setup and transaction flows](#wallet-setup-and-transaction-flows)
- [Frontend routes](#frontend-routes)
- [Smart-contract architecture](#smart-contract-architecture)
- [Deployment and funding](#deployment-and-funding)
- [Testing and quality checks](#testing-and-quality-checks)
- [Configuration reference](#configuration-reference)
- [Live testnet addresses](#live-testnet-addresses)
- [Troubleshooting](#troubleshooting)
- [Production-readiness checklist](#production-readiness-checklist)

## Product model

The current demo uses `mMON` as its single entry asset and mints the `DEMO`
share token. The basket is fixed when the vault is deployed:

| Asset | Target weight | Demo role |
|---|---:|---|
| `mGOV` | 40% | Mock governance token |
| `mLSMON` | 40% | Mock liquid-staked MON token |
| `mUSD` | 20% | Mock USD stable token |

When a user mints, the vault transfers mMON, allocates the amount by target
weight, swaps non-entry portions, values the received assets through the oracle,
and mints shares proportional to the USD value added. When a user redeems, the
vault burns shares and transfers a pro-rata slice of every asset it holds.
Redemption does not use the oracle or a swap and is intentionally never paused.

`DEMO` is a contract symbol, not a localhost label. The same symbol appears on
Monad testnet because it was selected in the deployment transaction.

## Repository layout

```text
contracts/core/       IndexVault and IndexFactory
contracts/oracle/     OracleRouter and staleness checks
contracts/interfaces/ IPriceOracle, IChainlinkFeed, ISwapRouter
contracts/mocks/      MockERC20, MockPriceFeed, MockSwapRouter
test/                 Hardhat TypeScript contract tests
scripts/              Deployment, smoke-test, and testnet-funding utilities
app/app/              Next.js routes and pages
app/components/       Wallet UI, navigation, landing sections, primitives
app/hooks/             Live folio data hooks
app/lib/               ABIs, network config, RPC and transaction helpers
app/lib/deployments/  Frontend deployment manifests
```

## Prerequisites and installation

Install Node.js 20+ and npm. An EVM wallet such as MetaMask is only required
for browser transactions; the public landing page can read chain data without
a wallet.

Install both dependency sets from the repository root:

```bash
npm install
cd app
npm install
cd ..
```

Never place a real private key in source control. Root `.env` and
`app/.env.local` are ignored by Git; use the example files as templates.

## Run locally

Start a local Hardhat chain in one terminal:

```bash
npx hardhat node
```

Deploy the complete local demo in another terminal:

```bash
npm run deploy:local
```

The deployment writes both `deployments/localhost.json` and
`app/lib/deployments/localhost.json`. Point the frontend at it with
`app/.env.local`:

```dotenv
NEXT_PUBLIC_ALLOY_NETWORK=localhost
NEXT_PUBLIC_LOCAL_RPC_URL=http://127.0.0.1:8545
```

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Development uses
`next dev --webpack` to avoid stale Turbopack HMR chunks while contracts and
environment variables are changing.

## Use the Monad testnet deployment

The default is the live Monad testnet manifest. To make the selection explicit:

```dotenv
NEXT_PUBLIC_ALLOY_NETWORK=testnet
```

Monad Testnet uses chain ID `10143`, native currency `MON`, RPC
`https://testnet-rpc.monad.xyz`, and explorer
`https://testnet.monadexplorer.com`. The wallet must be on chain 10143 before
mint, redeem, approval, or faucet transactions can be signed.

## Wallet setup and transaction flows

1. Open the app with MetaMask unlocked.
2. Click **Connect wallet** and approve the account request.
3. Approve the Monad Testnet network switch/add request.
4. Obtain testnet MON for gas and use the mMON faucet for entry tokens.
5. Enter a mint amount, approve mMON if prompted, then confirm the mint.
6. For redemption, enter no more than the displayed `DEMO` balance or use
   **Use max balance**, then confirm the single redeem request.

The frontend reads allowances and immediate post-transaction balances through
the injected wallet provider. It checks the chain before every write and will
not intentionally send a transaction on an incorrect chain. Read-only data
falls back to the configured RPC when no wallet is injected.

## Frontend routes

| Route | Purpose |
|---|---|
| `/` | Public landing page with live NAV, supply, prices, and held assets |
| `/app` | Folio dashboard with composition, mint, redeem, and faucet actions |
| `/app/deposit` | Deposit/mint entry point |
| `/app/faucet` | Test-token faucet entry point |
| `/app/pools` | Pool and reserve information |
| `/about` | Project information |

All app routes share the same wallet provider and navigation, so changing the
account or network is reflected across the entire application.

## Smart-contract architecture

### IndexVault

`IndexVault` is an ERC-20 share token with immutable basket assets, immutable
entry asset/router/oracle references, fixed target weights, proportional minting,
pro-rata redemption, and a guardian-controlled mint pause. Share issuance and
redemption floor-divide, leaving rounding dust in the vault for remaining
holders. The constructor rejects zero addresses, mismatched array lengths, and
weights that do not sum to 10,000 basis points.

### IndexFactory

`IndexFactory` deploys and records vaults. Since a basket is fixed after
deployment, a reweighted strategy should be deployed as a new vault rather than
mutating the existing one.

### OracleRouter

`OracleRouter` maps each asset to a Chainlink-compatible feed, rejects missing,
negative, or stale answers, and normalizes feed values to 18-decimal USD prices.
The current demo uses static mock feeds. A real deployment must use live feeds,
finite heartbeat/staleness limits, and an operating keeper or relay where the
selected oracle requires updates.

### Mock components

The mock ERC-20 is permissionlessly mintable, the mock feed is static, and the
mock swap router uses deterministic oracle pricing and assumes 18-decimal demo
tokens. These contracts exist for tests and the hackathon demo only; they must
not be used with mainnet funds.

## Deployment and funding

Create a root `.env`:

```dotenv
MONAD_TESTNET_RPC=https://testnet-rpc.monad.xyz
DEPLOYER_KEY=0xYOUR_PRIVATE_KEY
MONAD_EXPLORER_API_KEY=
```

Deploy locally or to Monad testnet:

```bash
npm run deploy:local
npm run deploy:testnet
```

The deploy script creates the demo tokens, feeds, router, factory, and vault,
funds router liquidity, and copies the resulting manifest into both deployment
directories. A testnet deployment therefore replaces the frontend addresses;
restart or refresh the frontend after changing the manifest.

To send gas to a wallet you control:

```powershell
$env:TEST_RECIPIENT = "0xYourWalletAddress"
$env:TEST_AMOUNT = "0.05"
npx hardhat run scripts/fund-testnet.ts --network monadTestnet
```

This sends native testnet MON only. Application transactions still require the
user to approve them in their wallet.

## Testing and quality checks

Run all checks before deployment or a Git push:

```bash
npm run compile
npm test
cd app
npm run lint
npm run build
```

The tests cover factory registration, weight validation, first and subsequent
minting, weighted swaps, pro-rata redemption, redemption while minting is
paused, guardian authorization, and rounding behavior.

For a funded live test account, run the smoke test against the selected manifest:

```bash
npx hardhat run scripts/smoke-test.ts --network monadTestnet
```

## Configuration reference

| File/variable | Meaning |
|---|---|
| `MONAD_TESTNET_RPC` | Hardhat testnet RPC |
| `DEPLOYER_KEY` | Deployment/funding account private key |
| `MONAD_EXPLORER_API_KEY` | Optional explorer verification key |
| `NEXT_PUBLIC_ALLOY_NETWORK` | Frontend manifest: `testnet` or `localhost` |
| `NEXT_PUBLIC_MONAD_TESTNET_RPC` | Optional browser fallback RPC |
| `NEXT_PUBLIC_LOCAL_RPC_URL` | Optional localhost fallback RPC |

The frontend selects `app/lib/deployments/monadTestnet.json` for `testnet` and
`app/lib/deployments/localhost.json` for `localhost`. Keep the manifest and
frontend network setting in sync.

## Live testnet addresses

Current checked-in Monad Testnet manifest (chain ID `10143`):

| Contract/token | Address |
|---|---|
| `mMON` entry token | `0x56b16A3D35D9dC84B195342eF40767A5969c563E` |
| `mGOV` | `0x9c3657D1B249622D15381B543f550Dee0c1CC362` |
| `mLSMON` | `0xCD9147797430286F5d5C9512AD5Fbb55aABd6138` |
| `mUSD` | `0x8F2938Bc8795401c9F1537fab363325511538587` |
| Oracle router | `0x3b5aFf6988cF5a908AD141A666BC30D491011463` |
| Mock swap router | `0x5ED9960a7E71359393C700A6F1684109753448aE` |
| Index factory | `0x4a06c7B07D0Ee0E163d26e6ebaFbE0E2CAa5E358` |
| Demo vault / `DEMO` | `0x77271B49Eb51a2B1c9c768f4EAB316bD3f832D56` |

The JSON manifest is authoritative if the contracts are redeployed.

## Troubleshooting

### MetaMask RPC or connection errors

Confirm chain ID `10143`, close stale confirmation windows, reject queued old
requests, and hard-refresh the page after switching networks. If MetaMask was
reinstalled or crashed, reload the tab so the app can obtain the new injected
provider object.

### `NAV unavailable`

NAV requires oracle reads. Balances and redeemable holdings can remain readable
while an oracle feed is stale or the public RPC is unavailable; the warning is
not by itself a failed redemption. Retry once the RPC/feed responds.

### Mint appears stuck

An approval may be waiting before the mint request. Confirm approval first and
wait for it to settle. If several requests are queued, reject all stale ones,
refresh the app, and retry.

### `InsufficientShares` on redeem

Redeem the exact displayed balance or a smaller amount. Do not round `0.9969`
up to `1`; use **Use max balance** to avoid precision mistakes.

### Next.js chunk/HMR error

Stop duplicate dev servers, close the tab, and restart `npm run dev`. The
production path can be checked with `cd app && npm run build && npm start`.

## Production-readiness checklist

Before accepting real funds, replace every mock token/feed/router; use audited
DEX and oracle integrations; set finite oracle heartbeat and stale-price limits;
add deviation and sequencer-uptime protections; test differing-decimal,
fee-on-transfer, rebasing, and non-standard ERC-20s; use a multisig guardian;
verify contracts; publish immutable manifests; and obtain an independent smart
contract audit.

## License

The project is MIT licensed. Solidity files also include SPDX license headers.
