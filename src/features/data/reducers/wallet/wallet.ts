import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { ChainEntity } from '../../entities/chain';
import { initWallet } from '../../actions/wallet';

/**
 * Only address and hideBalance are persisted
 */
export type WalletState = {
  initialized: boolean;
  address: string | null;
  ens: {
    byAddress: {
      [address: string]: string;
    };
  };
  connectedAddress: string | null;
  selectedChainId: ChainEntity['id'] | null;
  error: 'unsupported chain' | null;
  hideBalance: boolean;
  viewAsAddress: string | null;
};

const initialWalletState: WalletState = {
  initialized: false,
  address: null,
  ens: { byAddress: {} },
  connectedAddress: null,
  selectedChainId: null,
  error: null,
  hideBalance: false,
  viewAsAddress: null,
};

export const walletSlice = createSlice({
  name: 'wallet',
  initialState: initialWalletState,
  reducers: {
    /**
     * Wallet connection/disconnect actions
     */
    userDidConnect(
      sliceState,
      action: PayloadAction<{ chainId: ChainEntity['id']; address: string }>
    ) {
      sliceState.address = action.payload.address;
      sliceState.connectedAddress = action.payload.address;
      sliceState.selectedChainId = action.payload.chainId;
      sliceState.error = null;
    },
    walletHasDisconnected(sliceState) {
      sliceState.address = null;
      sliceState.connectedAddress = null;
      sliceState.error = null;
      sliceState.ens = null;
    },
    accountHasChanged(sliceState, action: PayloadAction<{ address: string }>) {
      sliceState.address = action.payload.address;
      sliceState.connectedAddress = action.payload.address;
      sliceState.ens = null;
    },
    chainHasChanged(
      sliceState,
      action: PayloadAction<{ chainId: ChainEntity['id']; address: string }>
    ) {
      sliceState.address = action.payload.address;
      sliceState.connectedAddress = action.payload.address;
      sliceState.selectedChainId = action.payload.chainId;
      sliceState.error = null;
    },
    chainHasChangedToUnsupported(
      sliceState,
      action: PayloadAction<{ networkChainId: string | number; address: string }>
    ) {
      sliceState.address = action.payload.address;
      sliceState.connectedAddress = action.payload.address;
      sliceState.selectedChainId = null;
      sliceState.error = 'unsupported chain';
    },
    setViewAsAddress(sliceState, action: PayloadAction<{ address: string | null }>) {
      sliceState.viewAsAddress = action.payload.address;
    },
    setEns(
      sliceState,
      action: PayloadAction<{
        address: string | null;
        ens: string;
      }>
    ) {
      const { ens, address } = action.payload;
      sliceState.ens.byAddress[address] = ens;
    },
    /**
     * Display configuration
     */
    setToggleHideBalance(sliceState) {
      sliceState.hideBalance = !sliceState.hideBalance;
    },
  },
  extraReducers: builder => {
    builder.addCase(initWallet.fulfilled, (sliceState, _action) => {
      // wallet connection api initialized
      sliceState.initialized = true;
    });
  },
});

export const {
  walletHasDisconnected,
  accountHasChanged,
  chainHasChanged,
  chainHasChangedToUnsupported,
  userDidConnect,
  setToggleHideBalance,
  setViewAsAddress,
  setEns,
} = walletSlice.actions;
