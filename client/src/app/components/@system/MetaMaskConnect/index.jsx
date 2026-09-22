// @system — MetaMask wallet connect button
// Mirrors Asymetric Ventures' MetaMaskConnect component.
// Only renders when authMode is 'web3' and wallet is available.

import { useState, useCallback } from 'react'
import web3Service from '../../../lib/@system/Web3Service'

export default function MetaMaskConnect({ onConnect, onError, className }) {
  const [connecting, setConnecting] = useState(false)
  const [address, setAddress] = useState(null)

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const addr = await web3Service.connect()
      setAddress(addr)
      if (onConnect) onConnect(addr)
    } catch (err) {
      if (onError) onError(err)
    } finally {
      setConnecting(false)
    }
  }, [onConnect, onError])

  const handleDisconnect = useCallback(() => {
    web3Service.disconnect()
    setAddress(null)
  }, [])

  if (!web3Service.isAvailable()) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        Install MetaMask
      </a>
    )
  }

  if (address) {
    return (
      <button onClick={handleDisconnect} className={className}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    )
  }

  return (
    <button onClick={handleConnect} disabled={connecting} className={className}>
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
