import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import Layout from '../components/Layout'
import '../styles/ConfigManagement.css'

const BOT_API_URL = 'http://localhost:3000'

export default function ConfigManagement() {
    const navigate = useNavigate()
    const [botStatus, setBotStatus] = useState('offline')
    const [pairingCode, setPairingCode] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [config, setConfig] = useState({
        owner: '',
        botNumber: '',
        setPair: '',
        thumbUrl: '',
        public: true,
        terminal: true,
        reactsw: false
    })
    const [loading, setLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [sessionInfo, setSessionInfo] = useState(null)

    useEffect(() => {
        fetchSessionInfo()
        const interval = setInterval(fetchSessionInfo, 5000)
        return () => clearInterval(interval)
    }, [botStatus])

    const fetchSessionInfo = async () => {
        try {
            const response = await fetch(`${BOT_API_URL}/api/session`)
            const data = await response.json()
            if (data.success) {
                setSessionInfo(data.data)
            }
        } catch (error) {
            console.error('Error fetching session:', error)
        }
    }

    useEffect(() => {
        // Connect to WebSocket
        const socket = io(BOT_API_URL)

        socket.on('status', (status) => {
            setBotStatus(status)
        })

        socket.on('pairing-code', (code) => {
            setPairingCode(code)
            setSuccessMsg('Pairing code received!')
        })

        socket.on('log', (log) => {
            console.log('Bot log:', log)
        })

        // Load current config
        loadConfig()

        return () => {
            socket.disconnect()
        }
    }, [])

    const loadConfig = async () => {
        try {
            const response = await fetch(`${BOT_API_URL}/api/config`)
            const data = await response.json()
            if (data.success) {
                setConfig(data.data)
            }
        } catch (error) {
            console.error('Error loading config:', error)
        }
    }

    const handlePairing = async (e) => {
        e.preventDefault()
        setLoading(true)
        setSuccessMsg('')
        setErrorMsg('')
        setPairingCode('')

        try {
            const response = await fetch(`${BOT_API_URL}/api/pairing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber })
            })

            const data = await response.json()

            if (data.success) {
                setSuccessMsg('Pairing request sent! Waiting for code...')
            } else {
                setErrorMsg(data.error || 'Pairing failed')
            }
        } catch (error) {
            setErrorMsg('Network error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveConfig = async (e) => {
        e.preventDefault()
        setLoading(true)
        setSuccessMsg('')
        setErrorMsg('')

        try {
            const response = await fetch(`${BOT_API_URL}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })

            const data = await response.json()

            if (data.success) {
                setSuccessMsg('Config saved successfully!')
            } else {
                setErrorMsg(data.error || 'Save failed')
            }
        } catch (error) {
            setErrorMsg('Network error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleResetSession = async () => {
        if (!window.confirm('Are you sure you want to reset the bot session?')) {
            return
        }

        setLoading(true)
        setSuccessMsg('')
        setErrorMsg('')

        try {
            const response = await fetch(`${BOT_API_URL}/api/reset`, {
                method: 'POST'
            })

            const data = await response.json()

            if (data.success) {
                setSuccessMsg('Session reset successfully!')
                setPairingCode('')
                setBotStatus('offline')
            } else {
                setErrorMsg(data.error || 'Reset failed')
            }
        } catch (error) {
            setErrorMsg('Network error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Layout>
            <div className="config-container">
                <div className="config-header">
                    {/* Back button removed - handled by Sidebar */}
                    <h1>Manajemen Config</h1>
                </div>

                <div className="config-content">
                    {successMsg && (
                        <div style={{
                            padding: '16px',
                            background: '#d1fae5',
                            color: '#065f46',
                            borderRadius: '12px',
                            marginBottom: '20px'
                        }}>
                            {successMsg}
                        </div>
                    )}

                    {errorMsg && (
                        <div style={{
                            padding: '16px',
                            background: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '12px',
                            marginBottom: '20px'
                        }}>
                            {errorMsg}
                        </div>
                    )}

                    {/* Bot Status */}
                    <div className="config-section">
                        <h2>Bot Status</h2>
                        <span className={`status-badge ${botStatus === 'online' ? 'online' : 'offline'}`}>
                            {botStatus === 'online' ? '● Online' : '● Offline'}
                        </span>
                    </div>

                    {/* Pairing Section */}
                    <div className="config-section">
                        <h2>WhatsApp Pairing</h2>
                        <form onSubmit={handlePairing} className="pairing-form">
                            <div className="form-group">
                                <label>Phone Number</label>
                                <input
                                    type="text"
                                    placeholder="628xxxxxxxxxx"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    required
                                    className="form-input"
                                />
                                <small style={{ color: '#64748b', fontSize: '13px' }}>Input nomor WhatsApp (format: 628xxx)</small>
                            </div>
                            <button type="submit" disabled={loading} className="pairing-btn">
                                {loading ? 'Processing...' : 'Request Pairing Code'}
                            </button>
                        </form>

                        {pairingCode && (
                            <div className="pairing-code-display">
                                <p>Pairing Code:</p>
                                <div className="pairing-code">{pairingCode}</div>
                                <small>Masukkan kode ini di WhatsApp Anda</small>
                            </div>
                        )}
                    </div>

                    {/* Connected Sessions */}
                    <div className="config-section">
                        <div className="section-header">
                            <h2>Connected Session</h2>
                        </div>

                        <div className="session-table-container">
                            {sessionInfo && sessionInfo.connected ? (
                                <table className="session-table">
                                    <thead>
                                        <tr>
                                            <th>Device / User</th>
                                            <th>WhatsApp ID</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <div className="device-info">
                                                    <div className="device-icon">📱</div>
                                                    <div>
                                                        <strong>{sessionInfo.user?.name || sessionInfo.user?.notify || 'Unknown Device'}</strong>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{sessionInfo.user?.id ? sessionInfo.user.id.split(':')[0] : 'N/A'}</td>
                                            <td>
                                                <span className="status-badge online">● Online</span>
                                            </td>
                                            <td>
                                                <button onClick={handleResetSession} className="delete-session-btn">
                                                    🗑️ Logout Session
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div className="no-session">
                                    <p>No active session found. Please pair your WhatsApp.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Config Section */}
                    <div className="config-section">
                        <h2>Bot Configuration</h2>
                        <form onSubmit={handleSaveConfig} className="config-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Owner Number</label>
                                    <input
                                        type="text"
                                        value={config.owner}
                                        onChange={(e) => setConfig({ ...config, owner: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Bot Number</label>
                                    <input
                                        type="text"
                                        value={config.botNumber}
                                        onChange={(e) => setConfig({ ...config, botNumber: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Set Pair</label>
                                    <input
                                        type="text"
                                        value={config.setPair}
                                        onChange={(e) => setConfig({ ...config, setPair: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Thumbnail URL</label>
                                    <input
                                        type="text"
                                        value={config.thumbUrl}
                                        onChange={(e) => setConfig({ ...config, thumbUrl: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.public}
                                        onChange={(e) => setConfig({ ...config, public: e.target.checked })}
                                    />
                                    Public Mode
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.terminal}
                                        onChange={(e) => setConfig({ ...config, terminal: e.target.checked })}
                                    />
                                    Terminal Mode
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={config.reactsw}
                                        onChange={(e) => setConfig({ ...config, reactsw: e.target.checked })}
                                    />
                                    Auto React SW
                                </label>
                            </div>

                            <button type="submit" disabled={loading} className="save-btn">
                                {loading ? 'Saving...' : 'Simpan Konfigurasi'}
                            </button>
                        </form>
                    </div>

                    {/* Reset Section */}
                    <div className="config-section">
                        <h2>Reset Bot Session</h2>
                        <p style={{ color: '#64748b', marginBottom: '16px' }}>
                            Reset bot session akan menghapus semua data sesi dan memulai dari awal.
                        </p>
                        <button onClick={handleResetSession} disabled={loading} className="reset-btn">
                            {loading ? 'Resetting...' : 'Reset Session'}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
