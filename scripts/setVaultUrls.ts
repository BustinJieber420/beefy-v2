import { mapValues, omit } from 'lodash';
import { getVaultsForChain } from './common/config';
import { saveJson } from './common/utils';
import { allChainIds, AppChainId } from './common/chains';
import { sortVaultKeys } from './common/vault-fields';
import type { VaultConfig } from '../src/features/data/apis/config-types';
import { getTokenById } from './common/tokens';
import { TokenEntity } from '../src/features/data/entities/token';

const WARN_MISSING_ASSET_ON_ACTIVE_VAULTS_ONLY: boolean = true;

type ChainProviderUrls = {
  [chain in AppChainId]?: {
    [tokenProviderId: string]: ProviderUrls | ProviderConfigWithCondition[];
  };
};

type ProviderUrls = {
  buyTokenUrl?: string;
  addLiquidityUrl?: string;
  removeLiquidityUrl?: string;
};

type ProviderConfigWithCondition = ProviderUrls & {
  condition: (vault: VaultConfig) => boolean;
};

// TODO rest of chains/providers
/**
 * {lp} - LP token address
 * {tokenN} - n-th address from vault assets[]; 'native' is replaced by native token symbol for that chain
 * {tokenN:wrapped} - n-th address from vault assets[]; 'native' is replaced by wrapped native token address for that chain
 * Adding :lower to any of the above will lowercase the result (e.g. {token0:lower})
 */
const URLS: ChainProviderUrls = {
  bsc: {
    pancakeswap: [
      {
        condition: (vault: VaultConfig) => vault.id.startsWith('cakev2-'),
        buyTokenUrl:
          'https://pancakeswap.finance/swap?inputCurrency={token0}&outputCurrency={token1}',
        addLiquidityUrl: 'https://pancakeswap.finance/v2/add/{token0}/{token1}',
        removeLiquidityUrl: 'https://pancakeswap.finance/v2/remove/{token0}/{token1}',
      },
    ],
  },
  fantom: {
    wigoswap: {
      addLiquidityUrl: 'https://wigoswap.io/add/{token0}/{token1}',
      removeLiquidityUrl: 'https://wigoswap.io/remove/{token0}/{token1}',
    },
    equalizer: {
      addLiquidityUrl: 'https://equalizer.exchange/liquidity/{lp}',
      removeLiquidityUrl: 'https://equalizer.exchange/liquidity/{lp}',
    },
    spiritswap: [
      {
        condition: (vault: VaultConfig) => vault.id.startsWith('spiritV2-'),
        buyTokenUrl: 'https://www.spiritswap.finance/swap/{token0}/{token1}',
        addLiquidityUrl: 'https://www.spiritswap.finance/liquidity/{token0}/{token1}',
        removeLiquidityUrl: 'https://www.spiritswap.finance/liquidity/{token0}/{token1}',
      },
    ],
  },
  optimism: {
    velodrome: [
      {
        condition: (vault: VaultConfig) =>
          vault.id.startsWith('velodrome-') && !vault.id.startsWith('velodrome-v2-'),
        buyTokenUrl: 'https://velodrome.finance/swap?from={token0}&to={token1}',
        addLiquidityUrl: 'https://v1.velodrome.finance/liquidity/manage?address={lp}',
        removeLiquidityUrl: 'https://v1.velodrome.finance/liquidity/manage?address={lp}',
      },
      {
        condition: (vault: VaultConfig) =>
          vault.id.startsWith('velodrome-v2-') && vault.token.includes(' sLP'),
        buyTokenUrl:
          'https://velodrome.finance/swap?from={token0:wrapped:lower}&to={token1:wrapped:lower}',
        addLiquidityUrl:
          'https://velodrome.finance/deposit?token0={token0:wrapped:lower}&token1={token1:wrapped:lower}&stable=true',
        removeLiquidityUrl: 'https://velodrome.finance/withdraw?pool={lp:lower}',
      },
      {
        condition: (vault: VaultConfig) =>
          vault.id.startsWith('velodrome-v2-') && vault.token.includes(' vLP'),
        buyTokenUrl:
          'https://velodrome.finance/swap?from={token0:wrapped:lower}&to={token1:wrapped:lower}',
        addLiquidityUrl:
          'https://velodrome.finance/deposit?token0={token0:wrapped:lower}&token1={token1:wrapped:lower}&stable=false',
        removeLiquidityUrl: 'https://velodrome.finance/withdraw?pool={lp:lower}',
      },
    ],
  },
};

function replaceUrlsForVault(
  vault: VaultConfig,
  addresses: Record<string, string>
): ProviderUrls | undefined {
  const urlsForProvider = URLS[vault.network]?.[vault.tokenProviderId];
  if (!urlsForProvider) {
    return undefined;
  }

  let urlsForVault: ProviderUrls | undefined;
  if (Array.isArray(urlsForProvider)) {
    const found = urlsForProvider.find(x => x.condition(vault));
    if (found) {
      urlsForVault = omit(found, 'condition');
    }
  } else {
    urlsForVault = urlsForProvider;
  }

  if (!urlsForVault) {
    return undefined;
  }

  return mapValues(urlsForVault, url => {
    const replaced = Object.entries(addresses).reduce((acc, [key, value]) => {
      return acc.replace(`{${key}}`, value);
    }, url);

    if (replaced.includes('{')) {
      throw new Error(`Missing replacement in ${replaced}`);
    }

    return replaced;
  });
}

async function getUrlsForVault(
  vault: VaultConfig,
  wnative: TokenEntity
): Promise<ProviderUrls | undefined> {
  if (vault.tokenAddress && vault.tokenProviderId) {
    const replacements = {
      lp: vault.tokenAddress,
      'lp:lower': vault.tokenAddress.toLowerCase(),
    };

    for (const i in vault.assets) {
      const asset = vault.assets[i];
      const token = await getTokenById(asset, vault.network);

      if (!token) {
        if (!WARN_MISSING_ASSET_ON_ACTIVE_VAULTS_ONLY || vault.status === 'active') {
          console.error(
            `Could not find token id ${asset} for vault ${vault.id} on ${vault.network}. Did you forget to update addressbook?`
          );
        }
        return undefined;
      }

      replacements[`token${i}`] = token.address === 'native' ? token.symbol : token.address;
      replacements[`token${i}:wrapped`] =
        token.address === 'native' ? wnative.address : token.address;
      replacements[`token${i}:lower`] = replacements[`token${i}`].toLowerCase();
      replacements[`token${i}:wrapped:lower`] = replacements[`token${i}:wrapped`].toLowerCase();
    }

    return replaceUrlsForVault(vault, replacements);
  }

  return undefined;
}

async function getModifiedConfig(chainId: AppChainId) {
  const vaults = await getVaultsForChain(chainId);
  const wnative = await getTokenById('wnative', chainId);

  return Promise.all(
    vaults.map(async vault => {
      if (vault.tokenAddress && vault.tokenProviderId) {
        const urls = await getUrlsForVault(vault, wnative);
        if (urls) {
          for (const [key, url] of Object.entries(urls)) {
            if (vault[key] !== url) {
              console.log(`Setting ${key} in vault ${vault.id} on ${vault.network}...`);
              vault = { ...vault, [key]: url };
            }
          }
        }
      }

      return sortVaultKeys(vault);
    })
  );
}

async function start() {
  const modified = await Promise.all(allChainIds.map(getModifiedConfig));

  for (let i = 0; i < allChainIds.length; i++) {
    await saveJson(`./src/config/vault/${allChainIds[i]}.json`, modified[i], true);
  }
}

start().catch(e => {
  console.error(e);
  process.exit(1);
});
