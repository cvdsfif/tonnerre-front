import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton';

export type TonnerreExampleConfig = {
    id: number
    counter: number
    address: Address
    ownerAddress: Address,
    code: Cell
}

export const tonnerreExampleConfigToCell = (config: TonnerreExampleConfig) => {
    return beginCell()
        .storeUint(config.id, 32)
        .storeUint(config.counter, 32)
        .storeAddress(config.address)
        .storeAddress(config.ownerAddress)
        .endCell();
}

export const Opcodes = {
    increase: 0x7e8764ef,
    store: 0x5904baf6,
    deposit: 0xf9471134,
    withdraw: 0xcb03bfaf,
}

const tonnerreConnector = (address: Readonly<Address>, init?: Readonly<{ code: Cell, data: Cell }>) => ({
    address,
    init,

    sendDeploy: async (provider: ContractProvider, via: Sender, value: bigint) => {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    },

    sendDeposit: async (provider: ContractProvider, sender: Sender, value: bigint) => {
        const msg_body = beginCell()
            .storeUint(Opcodes.deposit, 32)
            .storeUint(0, 64)
            .endCell();

        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
        })
    },

    sendNoCodeDeposit: async (
        provider: ContractProvider,
        sender: Sender,
        value: bigint
    ) => {
        const msg_body = beginCell().storeUint(0, 32).storeUint(0, 64).endCell()

        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
        })
    },

    sendWithdrawalRequest: async (provider: ContractProvider, sender: Sender, value: bigint, amount: bigint) => {
        const msg_body = beginCell()
            .storeUint(Opcodes.withdraw, 32)
            .storeUint(0, 64)
            .storeCoins(amount)
            .endCell();

        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
        })
    },

    getData: async (provider: ContractProvider) => {
        const { stack } = await provider.get("get_contract_storage_data", [])
        return {
            recentSender: stack.readAddress(),
            ownerAddress: stack.readAddress()
        }
    },

    sendIncrease: async (
        provider: ContractProvider,
        via: Sender,
        opts: {
            increaseBy: number;
            value: bigint;
            queryID?: number;
        }
    ) => {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.increase, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeUint(opts.increaseBy, 32)
                .endCell(),
        })
    },

    sendStore: async (
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) => {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.store, 32)
                .storeUint(0, 64)
                .endCell(),
        });
    },

    getCounter: async (provider: ContractProvider) => {
        const result = await provider.get('get_counter', []);
        return result.stack.readNumber();
    },

    getID: async (provider: ContractProvider) => {
        const result = await provider.get('get_id', []);
        return result.stack.readNumber();
    },

    getBalance: async (provider: ContractProvider) => {
        const { stack } = await provider.get("balance", [])
        return stack.readNumber()
    }
})

export type TonnerreConnector = ReturnType<typeof tonnerreConnector>

const retrier = (property: string | Symbol, caller: () => Promise<any>, retriesLeft = 12): Promise<any> => {
    return new Promise((resolve, reject) => {
        const promise = caller()
        if (promise.then === undefined || promise.then === undefined) {
            console.warn("The proxied function ${property} is not async")
            return promise
        }
        promise
            .then(result => {
                console.log(`Call of ${property}/${retriesLeft} successful:`, result)
                resolve(result)
            })
            .catch(err => {
                if (retriesLeft <= 0) {
                    console.error(`No more retry trials for ${property}, forwarding error`, err)
                    reject(err)
                }
                console.error(`Error in call of ${property}, retrying, ${retriesLeft} tentatives left`, err)
                setTimeout(() =>
                    retrier(property, caller, retriesLeft - 1)
                        .then(result => resolve(result))
                        .catch(error => reject(error))
                    ,
                    1000)
            })
    })
}

function connectorProxy(inner: TonnerreConnector) {
    return new Proxy(inner, {
        get(target, property, receiver) {
            const targetValue = Reflect.get(target, property, receiver);
            if (typeof targetValue === 'function') {
                return (...args: any[]) => {
                    console.log('Calling:', property, " Arguments:", args)
                    return retrier(property, () => targetValue.apply(this, args))
                }
            } else {
                return targetValue;
            }
        }
    })
}

const isTonnerreConfig = (config: TonnerreExampleConfig | Address): config is TonnerreExampleConfig =>
    (config as TonnerreExampleConfig).code !== undefined

const BASE_WORKCHAIN = 0

export const createTonnerreConnector = (config: TonnerreExampleConfig | Address) => {
    if (!isTonnerreConfig(config)) return connectorProxy(tonnerreConnector(config))

    const data = tonnerreExampleConfigToCell(config)
    const init = { code: config.code, data }
    const address = contractAddress(BASE_WORKCHAIN, init)
    return connectorProxy(tonnerreConnector(address, init))
}

class TonnerreExample implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

    static createFromAddress(address: Address) {
        return new TonnerreExample(address);
    }

    static createFromConfig(config: TonnerreExampleConfig, code: Cell, workchain = 0) {
        const data = tonnerreExampleConfigToCell(config);
        const init = { code, data };
        return new TonnerreExample(contractAddress(workchain, init), init);
    }

    sendDeploy = async (provider: ContractProvider, via: Sender, value: bigint) => {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    sendDeposit = async (provider: ContractProvider, sender: Sender, value: bigint) => {
        const msg_body = beginCell()
            .storeUint(Opcodes.deposit, 32)
            .storeUint(0, 64)
            .endCell();

        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
        })
    }

    sendNoCodeDeposit = async (
        provider: ContractProvider,
        sender: Sender,
        value: bigint
    ) => {
        const msg_body = beginCell().storeUint(0, 32).storeUint(0, 64).endCell()

        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
        })
    }

    sendWithdrawalRequest = async (provider: ContractProvider, sender: Sender, value: bigint, amount: bigint) => {
        const msg_body = beginCell()
            .storeUint(Opcodes.withdraw, 32)
            .storeUint(0, 64)
            .storeCoins(amount)
            .endCell();

        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
        })
    }

    getData = async (provider: ContractProvider) => {
        const { stack } = await provider.get("get_contract_storage_data", [])
        return {
            recentSender: stack.readAddress(),
            ownerAddress: stack.readAddress()
        }
    }

    sendIncrease = async (
        provider: ContractProvider,
        via: Sender,
        opts: {
            increaseBy: number;
            value: bigint;
            queryID?: number;
        }
    ) => {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.increase, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeUint(opts.increaseBy, 32)
                .endCell(),
        })
    }

    sendStore = async (
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) => {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.store, 32)
                .storeUint(0, 64)
                .endCell(),
        });
    }

    getCounter = async (provider: ContractProvider) => {
        const result = await provider.get('get_counter', []);
        return result.stack.readNumber();
    }

    getID = async (provider: ContractProvider) => {
        const result = await provider.get('get_id', []);
        return result.stack.readNumber();
    }

    getBalance = async (provider: ContractProvider) => {
        const { stack } = await provider.get("balance", [])
        return stack.readNumber()
    }
}
