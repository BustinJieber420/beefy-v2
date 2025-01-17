import type { IVaultType } from '../../vaults/IVaultType';
import type { IStrategy } from '../IStrategy';
import type {
  DepositOption,
  DepositQuote,
  InputTokenAmount,
  WithdrawOption,
  WithdrawQuote,
} from '../../transact-types';
import type { Step } from '../../../../reducers/wallet/stepper';
import type { Namespace, TFunction } from 'react-i18next';

/**
 * This is just a wrapper around IVaultType to make it an IStrategy
 */
export class VaultStrategy<T extends IVaultType> implements IStrategy {
  readonly id: string = 'vault';

  constructor(protected readonly vaultType: T) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async initialize(): Promise<void> {}

  async fetchDepositOptions(): Promise<DepositOption[]> {
    return [await this.vaultType.fetchDepositOption()];
  }

  async fetchDepositQuote(
    inputs: InputTokenAmount[],
    option: DepositOption
  ): Promise<DepositQuote> {
    return this.vaultType.fetchDepositQuote(inputs, option);
  }

  async fetchDepositStep(quote: DepositQuote, t: TFunction<Namespace>): Promise<Step> {
    return this.vaultType.fetchDepositStep(quote, t);
  }

  async fetchWithdrawOptions(): Promise<WithdrawOption[]> {
    return [await this.vaultType.fetchWithdrawOption()];
  }

  async fetchWithdrawQuote(
    inputs: InputTokenAmount[],
    option: WithdrawOption
  ): Promise<WithdrawQuote> {
    return this.vaultType.fetchWithdrawQuote(inputs, option);
  }

  async fetchWithdrawStep(quote: WithdrawQuote, t: TFunction<Namespace>): Promise<Step> {
    return this.vaultType.fetchWithdrawStep(quote, t);
  }
}
