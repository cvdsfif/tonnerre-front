import './App.css'
import { TonConnectButton } from '@tonconnect/ui-react'
import { useTonnerreExample } from "./hooks/useTonnerreExample";
import { useTonConnect } from './hooks/useTonConnect';
import WebApp from '@twa-dev/sdk';

function App() {
  const {
    contractAddress,
    recentSender,
    ownerAddress,
    balance,
    counter,
    sendIncrement
  } = useTonnerreExample()
  const connected = useTonConnect()
  return (
    <div>
      <div>
        <TonConnectButton />
      </div>
      <div>
        <div className='Card'>
          <b>Platform: {WebApp.platform}</b><br />
          <b>Our contract Address</b>
          <div className='Hint'>{contractAddress?.slice(0, 30) + "..."}</div>
          <b>Our contract Balance</b>
          <div className='Hint'>{(balance ?? 0) / 1_000_000_000} TON</div>
        </div>

        <div className='Card'>
          <b>Owner</b>
          <div>{ownerAddress?.toString().slice(0, 30) ?? "Loading"}...</div>
        </div>
        <div className='Card'>
          <b>Counter</b>
          <div>{counter ?? "Loading..."}</div>
        </div>
        <div className='Card'>
          <b>Recent sender</b>
          <div>{recentSender?.toString().slice(0, 30) ?? "Loading"}...</div>
        </div>
        {connected && (
          <a
            onClick={() => {
              sendIncrement();
            }}
          >
            Increment
          </a>
        )}
      </div>
    </div>
  )
}

export default App
