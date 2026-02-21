import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

    // Auto-clear messages after 5 seconds
    useEffect(() => {
        if (successMsg || errorMsg) {
            const timer = setTimeout(() => {
                setSuccessMsg('')
                setErrorMsg('')
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [successMsg, errorMsg])
    const [sessionInfo, setSessionInfo] = useState(null)

    const [storeConfig, setStoreConfig] = useState({
        name: '',
        phone: '',
        address: '',
        area_id: '',
        postal_code: '',
        latitude: '',
        longitude: ''
    })
    const [loadingStore, setLoadingStore] = useState(true)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

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
        fetchSessionInfo()
        const interval = setInterval(fetchSessionInfo, 5000)
        return () => clearInterval(interval)
    }, [botStatus])

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
        fetchStoreConfig()

        return () => {
            socket.disconnect()
        }
    }, [])

    const fetchStoreConfig = async () => {
        try {
            const response = await fetch(`${BOT_API_URL}/api/store-config`)
            const result = await response.json()
            if (result.success) {
                setStoreConfig(result.data)
            }
        } catch (error) {
            console.error('Error fetching store config:', error)
        } finally {
            setLoadingStore(false)
        }
    }

    const handleStoreChange = (e) => {
        const { name, value } = e.target
        setStoreConfig(prev => ({
            ...prev,
            [name]: value
        }))
    }

    // BITESHIP SYNC LOGIC
    const [biteshipLocations, setBiteshipLocations] = useState([])
    const [loadingBiteship, setLoadingBiteship] = useState(false)

    useEffect(() => {
        // Initial fetch on load
        fetchBiteshipLocations()
    }, [])

    const handleSyncBiteship = async () => {
        setLoadingBiteship(true)
        try {
            const response = await fetch(`${BOT_API_URL}/api/biteship/pickup-locations`)
            const result = await response.json()
            if (result.success && Array.isArray(result.data)) {
                setBiteshipLocations(result.data)

                // Try to find the currently active location in the fresh list
                let currentActive = result.data.find(loc => isActiveBiteshipAddress(loc))

                // If no match found but there is only 1 location in Biteship, force use it
                if (!currentActive && result.data.length === 1) {
                    currentActive = result.data[0]
                }

                if (currentActive) {
                    // Update local config to match Biteship's latest data
                    const newConfig = {
                        name: currentActive.name,
                        phone: currentActive.contact_phone,
                        address: currentActive.address,
                        area_id: currentActive.area_id,
                        postal_code: currentActive.postal_code,
                        latitude: currentActive.coordinate ? currentActive.coordinate.latitude : currentActive.latitude,
                        longitude: currentActive.coordinate ? currentActive.coordinate.longitude : currentActive.longitude,
                        contact_name: currentActive.contact_name
                    }

                    // Save to backend automatically
                    await fetch(`${BOT_API_URL}/api/store-config`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newConfig)
                    })

                    setStoreConfig(newConfig)
                    setSuccessMsg('Informasi berhasil disinkronisasi ulang dari Biteship!')
                } else {
                    setSuccessMsg('Data Biteship diperbarui. Silakan pilih alamat aktif jika belum sesuai.')
                }
            }
        } catch (error) {
            console.error('Error fetching biteship locations:', error)
            setErrorMsg('Gagal mengambil data dari Biteship')
        } finally {
            setLoadingBiteship(false)
        }
    }

    const fetchBiteshipLocations = async () => {
        setLoadingBiteship(true)
        try {
            const response = await fetch(`${BOT_API_URL}/api/biteship/pickup-locations`)
            const result = await response.json()
            if (result.success && Array.isArray(result.data)) {
                setBiteshipLocations(result.data)
            }
        } catch (error) {
            console.error('Error fetching biteship locations:', error)
            setErrorMsg('Gagal mengambil data dari Biteship')
        } finally {
            setLoadingBiteship(false)
        }
    }

    const isActiveBiteshipAddress = (loc) => {
        // 1. Match by Coordinates (Highest Precision)
        if (storeConfig.latitude && storeConfig.longitude && loc.latitude && loc.longitude) {
            return String(storeConfig.latitude) === String(loc.latitude) &&
                String(storeConfig.longitude) === String(loc.longitude)
        }

        // 2. Match by Area ID + Postal Code (High Precision)
        if (storeConfig.area_id && loc.area_id) {
            return String(storeConfig.area_id) === String(loc.area_id) &&
                String(storeConfig.postal_code) === String(loc.postal_code)
        }

        // 3. Fallback: Match by Phone Number (Last Resort)
        // Normalize phones (remove non-digits) to compare
        const storePhone = (storeConfig.phone || '').replace(/\D/g, '').replace(/^62/, '0')
        const locPhone = (loc.contact_phone || '').replace(/\D/g, '').replace(/^62/, '0')

        if (storePhone && locPhone && storePhone === locPhone) {
            return true
        }

        // 4. Fallback: Match by Name + Address (Legacy)
        return storeConfig.name === loc.name && storeConfig.address === loc.address
    }

    const handleSelectBiteshipAddress = async (loc) => {
        if (!window.confirm(`Gunakan alamat "${loc.name}" sebagai lokasi toko aktif?`)) return

        setLoading(true)
        try {
            // Map Biteship Location object to our Store Config format
            const newConfig = {
                name: loc.name,
                phone: loc.contact_phone,
                address: loc.address,
                area_id: loc.area_id, // This is the Area ID for shipping
                postal_code: loc.postal_code,
                latitude: loc.latitude,
                longitude: loc.longitude,
                contact_name: loc.contact_name
            }

            const response = await fetch(`${BOT_API_URL}/api/store-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            })
            const result = await response.json()
            if (result.success) {
                fetchStoreConfig() // Refresh active config
                setSuccessMsg('Alamat Toko berhasil diganti dari Biteship!')
            }
        } catch (error) {
            console.error('Error setting active address:', error)
            setErrorMsg('Gagal mengganti alamat toko')
        } finally {
            setLoading(false)
        }
    }

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
                    <div className="section-header">
                        <h1>Manajemen Config</h1>
                        <div className="notification-area">
                            {successMsg && (
                                <div className="alert success toast">
                                    <span>{successMsg}</span>
                                    <button className="close-alert" onClick={() => setSuccessMsg('')}>✕</button>
                                </div>
                            )}
                            {errorMsg && (
                                <div className="alert error toast">
                                    <span>{errorMsg}</span>
                                    <button className="close-alert" onClick={() => setErrorMsg('')}>✕</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="config-content">
                    {/* ... Bot Status & Pairing ... */}
                    <div className="config-section">
                        <h2>Bot Status</h2>
                        <span className={`status-badge ${botStatus === 'online' ? 'online' : 'offline'}`}>
                            {botStatus === 'online' ? '● Online' : '● Offline'}
                        </span>
                    </div>

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
                            </div>
                            <button type="submit" disabled={loading} className="pairing-btn">
                                {loading ? 'Processing...' : 'Request Pairing Code'}
                            </button>
                        </form>
                        {pairingCode && (
                            <div className="pairing-code-display">
                                <p>Pairing Code:</p>
                                <div className="pairing-code">{pairingCode}</div>
                            </div>
                        )}
                    </div>

                    {/* ... Connected Session ... */}
                    <div className="config-section">
                        <h2>Connected Session</h2>
                        {sessionInfo && sessionInfo.connected ? (
                            <div className="session-table-container">
                                <table className="session-table">
                                    <thead>
                                        <tr>
                                            <th>Status</th>
                                            <th>Nama Bot</th>
                                            <th>Nomor WhatsApp</th>
                                            <th>Device</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <span className="status-badge online">● Online</span>
                                            </td>
                                            <td>
                                                {sessionInfo.user?.name && sessionInfo.user?.name !== '~'
                                                    ? sessionInfo.user.name
                                                    : 'WhatsApp Bot'}
                                            </td>
                                            <td>
                                                {sessionInfo.user?.id ? sessionInfo.user.id.split(':')[0] : '-'}
                                            </td>
                                            <td>Baileys MD</td>
                                            <td>
                                                <button onClick={handleResetSession} className="delete-session-btn">
                                                    Logout
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="session-card offline">
                                <p>No active session. Silakan pairing di bawah.</p>
                            </div>
                        )}
                    </div>

                    {/* ... Bot Configuration ... */}
                    <div className="config-section">
                        <h2>Bot Configuration</h2>
                        <form onSubmit={handleSaveConfig} className="config-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Owner Number</label>
                                    <input type="text" value={config.owner} onChange={(e) => setConfig({ ...config, owner: e.target.value })} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label>Bot Number</label>
                                    <input type="text" value={config.botNumber} onChange={(e) => setConfig({ ...config, botNumber: e.target.value })} className="form-input" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Set Pair</label>
                                    <input type="text" value={config.setPair} onChange={(e) => setConfig({ ...config, setPair: e.target.value })} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label>Thumb URL</label>
                                    <input type="text" value={config.thumbUrl} onChange={(e) => setConfig({ ...config, thumbUrl: e.target.value })} className="form-input" />
                                </div>
                            </div>
                            <div className="form-row">
                                <label><input type="checkbox" checked={config.public} onChange={(e) => setConfig({ ...config, public: e.target.checked })} /> Public</label>
                                <label><input type="checkbox" checked={config.terminal} onChange={(e) => setConfig({ ...config, terminal: e.target.checked })} /> Terminal</label>
                                <label><input type="checkbox" checked={config.reactsw} onChange={(e) => setConfig({ ...config, reactsw: e.target.checked })} /> Auto Read SW</label>
                            </div>
                            <button type="submit" className="save-btn" disabled={loading}>Simpan Konfigurasi</button>
                        </form>
                    </div>

                    {/* BITESHIP ADDRESS SECTION */}
                    <div className="config-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h2>Alamat Penjemputan (Biteship)</h2>
                                <p style={{ color: '#64748b', margin: '5px 0 0 0' }}>
                                    Pilih alamat dari akun Biteship Anda untuk digunakan sebagai lokasi toko.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="btn-edit"
                                    style={{ background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    ✏️ Detail / Edit Toko
                                </button>
                                <button
                                    onClick={handleSyncBiteship}
                                    disabled={loadingBiteship}
                                    className="btn-edit"
                                    style={{ background: '#0ea5e9', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {loadingBiteship ? 'Mengambil...' : '🔄 Sinkronisasi dari Biteship'}
                                </button>
                            </div>
                        </div>

                        {loadingBiteship && <p style={{ textAlign: 'center', padding: '20px' }}>Sedang memuat data dari Biteship...</p>}

                        {!loadingBiteship && biteshipLocations.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                <p>Tidak ada alamat penjemputan ditemukan di Biteship.</p>
                                <a href="https://dashboard.biteship.com/locations" target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>
                                    Tambah Alamat di Dashboard Biteship
                                </a>
                            </div>
                        )}

                        <div className="address-list">
                            {biteshipLocations.map((loc) => {
                                const active = isActiveBiteshipAddress(loc)
                                return (
                                    <div key={loc.id} className={`address-card ${active ? 'active-card' : ''}`}>
                                        <div className="address-header">
                                            {/* If active, show storeConfig name, else show loc name */}
                                            <h3>{active ? storeConfig.name : loc.name}</h3>
                                            {active && <span className="badge-active">Sedang Digunakan</span>}
                                        </div>
                                        {/* Address is usually the same, but let's be consistent */}
                                        <p className="address-text">{active ? storeConfig.address : loc.address}</p>
                                        <p className="address-detail">
                                            {loc.city}, {loc.province} {loc.postal_code}
                                        </p>
                                        <p className="address-detail" style={{ fontWeight: '500', color: '#334155' }}>
                                            {/* If active, show storeConfig contact_name */}
                                            👤 {active ? (storeConfig.contact_name || '-') : (loc.contact_name || '-')}
                                        </p>
                                        <p className="address-phone">
                                            {/* If active, show storeConfig phone */}
                                            📞 {active ? (storeConfig.phone || '-') : (loc.contact_phone || '-')}
                                        </p>

                                        {!active && (
                                            <button
                                                onClick={() => handleSelectBiteshipAddress(loc)}
                                                className="btn-use"
                                                style={{ width: '100%', marginTop: '10px' }}
                                            >
                                                Gunakan Alamat Ini
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* EDIT STORE MODAL */}
                    {isEditModalOpen && (
                        <div className="modal-overlay">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h3>Edit Informasi Toko</h3>
                                    <button onClick={() => setIsEditModalOpen(false)} className="close-btn">×</button>
                                </div>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label>Nama Toko</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={storeConfig.name}
                                            onChange={handleStoreChange}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Nama Pengirim (Contact Name)</label>
                                        <input
                                            type="text"
                                            name="contact_name"
                                            value={storeConfig.contact_name || ''}
                                            readOnly
                                            className="form-input"
                                            style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>No HP Toko</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={storeConfig.phone}
                                            readOnly
                                            className="form-input"
                                            style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Alamat Lengkap</label>
                                        <textarea
                                            name="address"
                                            rows="3"
                                            value={storeConfig.address}
                                            readOnly
                                            className="form-input"
                                            style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button onClick={() => setIsEditModalOpen(false)} className="cancel-btn">Batal</button>
                                    <button
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                const response = await fetch(`${BOT_API_URL}/api/store-config`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(storeConfig)
                                                });
                                                const result = await response.json();
                                                if (result.success) {
                                                    setSuccessMsg('Informasi Toko berhasil diperbarui!');
                                                    setIsEditModalOpen(false);
                                                    fetchStoreConfig();
                                                }
                                            } catch (e) {
                                                setErrorMsg('Gagal menyimpan: ' + e.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="save-btn"
                                        disabled={loading}
                                    >
                                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
