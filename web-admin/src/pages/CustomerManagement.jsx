import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import '../styles/CustomerManagement.css'

export default function CustomerManagement() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [sessions, setSessions] = useState({})

    useEffect(() => {
        fetchCustomers()
        fetchSessions()
    }, [])

    const fetchCustomers = async () => {
        try {
            setLoading(true)
            const { data, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError
            setCustomers(data || [])
        } catch (err) {
            setError(err.message)
            console.error('Error fetching customers:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchSessions = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/sessions')
            if (res.ok) {
                const data = await res.json()
                setSessions(data)
            }
        } catch (err) {
            console.log('Sessions API not available')
        }
    }

    const getSessionBadge = (phone) => {
        const jid = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
        const session = sessions[jid]
        if (!session) return { label: 'Idle', className: 'session-idle' }

        const handler = session.handler
        if (handler === 'cs') return { label: '💬 Chat CS', className: 'session-cs' }
        if (handler === 'ongkir') {
            const stage = session.data?.stage || ''
            if (stage.includes('payment')) return { label: '💳 Pembayaran', className: 'session-payment' }
            if (stage.includes('courier')) return { label: '🚚 Pilih Kurir', className: 'session-order' }
            return { label: '🛒 Ordering', className: 'session-order' }
        }
        return { label: handler, className: 'session-active' }
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const filteredCustomers = customers.filter(c => {
        const s = searchTerm.toLowerCase()
        return (
            (c.push_name || '').toLowerCase().includes(s) ||
            (c.full_name || '').toLowerCase().includes(s) ||
            (c.phone_number || '').includes(s) ||
            (c.city || '').toLowerCase().includes(s)
        )
    })

    return (
        <Layout>
            <div className="customer-container">
                <div className="customer-header">
                    <h1>👥 Manajemen Customer</h1>
                    <span className="customer-count">{customers.length} customer</span>
                </div>

                <div className="customer-controls">
                    <div className="search-box">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Cari customer (nama, telepon, kota)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <button onClick={() => { fetchCustomers(); fetchSessions() }} className="refresh-btn">
                        🔄 Refresh
                    </button>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="table-container">
                    <table className="customer-table">
                        <thead>
                            <tr>
                                <th>Nama</th>
                                <th>No. Telepon</th>
                                <th>Kota</th>
                                <th>Session</th>
                                <th>Terdaftar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div className="loading-spinner">Loading...</div>
                                    </td>
                                </tr>
                            ) : filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-state">
                                        Belum ada customer yang terdaftar.
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer) => {
                                    const sessionInfo = getSessionBadge(customer.phone_number)
                                    return (
                                        <tr key={customer.phone_number}>
                                            <td>
                                                <div className="customer-name">
                                                    {customer.full_name || customer.push_name || 'Unknown'}
                                                </div>
                                                {customer.push_name && customer.full_name && (
                                                    <div className="customer-pushname">
                                                        WA: {customer.push_name}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className="phone-number">{customer.phone_number}</span>
                                            </td>
                                            <td>{customer.city || '-'}</td>
                                            <td>
                                                <span className={`session-badge ${sessionInfo.className}`}>
                                                    {sessionInfo.label}
                                                </span>
                                            </td>
                                            <td className="date-cell">{formatDate(customer.created_at)}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    )
}
