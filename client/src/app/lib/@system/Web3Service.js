// @system — Web3 wallet service
// Mirrors Asymetric Ventures' Web3Service.js (MetaMask wallet connect, sign, verify).
// Requires ethers as an optional dependency. Gracefully no-ops when unavailable.

let ethers = null
let ethersLoaded = false

async function loadEthers() {
  if (ethersLoaded) return ethers
  ethersLoaded = true
  try {
    ethers = await import('ethers')
  } catch {
    // ethers not installed — Web3 features disabled
    ethers = null
  }
  return ethers
}

class Web3Service {
  constructor() {
    this.provider = null
    this.signer = null
    this.address = null
    this.chainId = null
    this._listeners = []
  }

  /** Check if MetaMask (or compatible wallet) is available */
  isAvailable() {
    return typeof window !== 'undefined' && !!window.ethereum
  }

  /** Check if ethers library is loaded */
  isEnabled() {
    return !!ethers
  }

  /** Connect to MetaMask and return the wallet address */
  async connect() {
    if (!this.isAvailable()) throw new Error('No wallet detected. Please install MetaMask.')
    const eth = await loadEthers()
    if (!eth) throw new Error('ethers library not installed')

    this.provider = new eth.BrowserProvider(window.ethereum)
    await this.provider.send('eth_requestAccounts', [])
    this.signer = await this.provider.getSigner()
    this.address = await this.signer.getAddress()

    const network = await this.provider.getNetwork()
    this.chainId = Number(network.chainId)

    this._setupListeners()
    return this.address
  }

  /** Disconnect wallet (clear local state) */
  disconnect() {
    this._removeListeners()
    this.provider = null
    this.signer = null
    this.address = null
    this.chainId = null
  }

  /** Check if wallet is connected */
  isConnected() {
    return !!this.address
  }

  /** Sign a message for authentication (timestamp-based to prevent replay) */
  async signLogin() {
    if (!this.signer) throw new Error('Wallet not connected')
    const timestamp = Date.now()
    const message = `Sign in to ${window.location.hostname}\nTimestamp: ${timestamp}`
    const signature = await this.signer.signMessage(message)
    return { address: this.address, message, signature, timestamp }
  }

  /** Sign an arbitrary message */
  async signMessage(message) {
    if (!this.signer) throw new Error('Wallet not connected')
    return this.signer.signMessage(message)
  }

  /** Verify a signed message (client-side check) */
  static async verifyMessage(message, signature) {
    const eth = await loadEthers()
    if (!eth) throw new Error('ethers library not installed')
    return eth.verifyMessage(message, signature)
  }

  /** Switch to a different network */
  async switchNetwork(chainId) {
    if (!this.isAvailable()) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + chainId.toString(16) }],
      })
    } catch (err) {
      if (err.code === 4902) throw new Error('Network not configured in wallet')
      throw err
    }
  }

  /** Get a read-only contract instance */
  getContract(address, abi) {
    if (!ethers || !this.provider) throw new Error('Not connected')
    return new ethers.Contract(address, abi, this.provider)
  }

  /** Get a contract instance with signer (for write operations) */
  getContractWithSigner(address, abi) {
    if (!ethers || !this.signer) throw new Error('Wallet not connected')
    return new ethers.Contract(address, abi, this.signer)
  }

  // ── Internal listeners ──────────────────────────────────────────────────

  _setupListeners() {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        this.disconnect()
      } else {
        this.address = accounts[0]
      }
    }

    const handleChainChanged = (chainIdHex) => {
      this.chainId = parseInt(chainIdHex, 16)
      // Reload recommended by MetaMask on chain change
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    this._listeners = [
      { event: 'accountsChanged', handler: handleAccountsChanged },
      { event: 'chainChanged', handler: handleChainChanged },
    ]
  }

  _removeListeners() {
    if (!window.ethereum) return
    for (const { event, handler } of this._listeners) {
      window.ethereum.removeListener(event, handler)
    }
    this._listeners = []
  }
}

// Singleton export
const web3Service = new Web3Service()
export default web3Service
export { Web3Service }
