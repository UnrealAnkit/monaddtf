export const INDEX_VAULT_ABI = [
  "error ZeroAmount()",
  "error InsufficientShares()",
  "error MintIsPaused()",
  "error SlippageExceeded()",
  "function mint(uint256 amountIn, uint256 minSharesOut) returns (uint256 sharesOut)",
  "function redeem(uint256 shares) returns (uint256[] amountsOut)",
  "function navPerShare() view returns (uint256)",
  "function totalValueUSD() view returns (uint256)",
  "function basketLength() view returns (uint256)",
  "function assets(uint256) view returns (address)",
  "function targetWeightsBps(uint256) view returns (uint256)",
  "function entryAsset() view returns (address)",
  "function mintPaused() view returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

export const ORACLE_ROUTER_ABI = [
  "function getPriceUSD(address asset) view returns (uint256 price, uint256 updatedAt)",
];

export const ERC20_ABI = [
  "function mint(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];
