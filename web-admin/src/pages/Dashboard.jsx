import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import Layout from '../components/Layout'
import '../styles/Dashboard.css'

const BOT_API_URL = 'http://localhost:3000'

export default function Dashboard() {
    const navigate = useNavigate()
    const [botStatus, setBotStatus] = useState('offline')
    const [whatsappStatus, setWhatsappStatus] = useState('Not Connected')

    useEffect(() => {
        // Connect to WebSocket for real-time updates
        const socket = io(BOT_API_URL)

        socket.on('connect', () => {
            console.log('Connected to bot server')
        })

        socket.on('status', (status) => {
            console.log('Bot status:', status)
            setBotStatus(status)
            if (status === 'online') {
                setWhatsappStatus('Connected')
            } else {
                setWhatsappStatus('Not Connected')
            }
        })

        socket.on('disconnect', () => {
            console.log('Disconnected from bot server')
        })

        // Fetch initial status
        fetch(`${BOT_API_URL}/api/status`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setBotStatus(data.status)
                    if (data.status === 'online') {
                        setWhatsappStatus('Connected')
                    }
                }
            })
            .catch(err => console.error('Error fetching status:', err))

        return () => {
            socket.disconnect()
        }
    }, [])

    const handleLogout = async () => {
        try {
            await signOut()
            navigate('/login')
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    return (
        <Layout>
            <div className="dashboard-container">

                <div className="dashboard-content">
                    <div className="welcome-section">
                        <h2 className="welcome-title">Selamat Datang! 👋</h2>
                        <p className="welcome-subtitle">Kelola konfigurasi bot dan produk Anda dengan mudah</p>
                    </div>

                    <div className="cards-grid">
                        <div className="management-card" onClick={() => navigate('/config')}>
                            <div className="card-icon">⚙️</div>
                            <div className="card-content">
                                <h3>Manajemen Config</h3>
                                <p>Edit konfigurasi bot dan lakukan pairing</p>
                            </div>
                            <span className="card-arrow">→</span>
                        </div>

                        <div className="management-card" onClick={() => navigate('/products')}>
                            <div className="card-icon">📦</div>
                            <div className="card-content">
                                <h3>Manajemen Produk</h3>
                                <p>Kelola produk yang dijual melalui bot</p>
                            </div>
                            <span className="card-arrow">→</span>
                        </div>
                    </div>

                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                                <h3>Status Bot</h3>
                                <p className={`stat-value ${botStatus === 'online' ? 'online' : 'offline'}`}>
                                    ● {botStatus === 'online' ? 'Online' : 'Offline'}
                                </p>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">📱</div>
                            <div className="stat-content">
                                <h3>WhatsApp</h3>
                                <p className={`stat-value ${whatsappStatus === 'Connected' ? 'online' : 'offline'}`}>
                                    {whatsappStatus}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
