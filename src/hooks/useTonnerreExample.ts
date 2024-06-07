import { useEffect, useState } from "react";
import { useTonClient } from "./useTonClient";
import { useAsyncInitialize } from "./useAsyncInitialise";
import { Address, OpenedContract, toNano } from "ton";
import { useTonConnect } from "./useTonConnect";
import { TonnerreConnector, createTonnerreConnector } from "../contracts/TonnerreExample";

export function useTonnerreExample() {
    const client = useTonClient();
    const [contractData, setContractData] = useState<null | {
        recentSender: Address;
        ownerAddress: Address;
        balance: number,
        counter: number
    }>()

    const { sender } = useTonConnect()
    const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time))

    const mainContract = useAsyncInitialize(async () => {
        if (!client) return;
        const contract = createTonnerreConnector(
            Address.parse("0QCXIWd86sfFmlx2YL1SAX9jJS_jWXEVtGRNS3DCyduybU2A")
        )
        return client.open(contract) as OpenedContract<TonnerreConnector>
    }, [client])

    useEffect(() => {
        async function getValue() {
            if (!mainContract) return
            setContractData(null)
            const val = await mainContract.getData()
            const balance = await mainContract.getBalance()
            const counter = await mainContract.getCounter()
            setContractData({
                recentSender: val.recentSender,
                ownerAddress: val.ownerAddress,
                balance,
                counter
            })

            await sleep(10000); // sleep 10 seconds and poll value again
            getValue()
        }
        getValue();
    }, [mainContract]);

    return {
        contractAddress: mainContract?.address.toString(),
        sendIncrement: () => {
            return mainContract?.sendIncrease(sender, {
                value: toNano(0.05),
                increaseBy: 3
            })
        },
        ...contractData,
    };
}