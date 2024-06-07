import { getHttpEndpoint } from '@orbs-network/ton-access';
import { TonClient } from 'ton';
import { useAsyncInitialize as useAsyncInitialise } from './useAsyncInitialise';

export function useTonClient() {
    return useAsyncInitialise(
        async () =>
            new TonClient({
                endpoint: await getHttpEndpoint({ network: 'testnet' }),
            })
    );
}