import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import '../styles/OrderManagement.css'

export default function OrderManagement() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        try {
            setLoading(true)

            // 1. Fetch Orders (join with customers is safe if FK exists)
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select(`
                    *,
                    customers:customer_phone (full_name, push_name)
                `)
                .order('created_at', { ascending: false })

            if (ordersError) throw ordersError

            // 2. Fetch Products
            const { data: productsData, error: productsError } = await supabase
                .from('product')
                .select('IDprod, NameProd')

            if (productsError) throw productsError

            // 3. Map products to orders
            const mappedOrders = (ordersData || []).map(order => {
                const product = productsData.find(p => String(p.IDprod) === String(order.product_id))
                return {
                    ...order,
                    product: product || null
                }
            })

            setOrders(mappedOrders)
        } catch (err) {
            setError(err.message)
            console.error('Error fetching orders:', err)
        } finally {
            setLoading(false)
        }
    }

    // Helper to format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR'
        }).format(amount)
    }

    // Helper to format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Filter orders based on search
    const filteredOrders = orders.filter(order => {
        const searchLower = searchTerm.toLowerCase()
        const customerName = order.customers?.full_name || order.customers?.push_name || 'Guest'
        const productName = order.product?.NameProd || 'Unknown Product'
        return (
            customerName.toLowerCase().includes(searchLower) ||
            productName.toLowerCase().includes(searchLower) ||
            order.status?.toLowerCase().includes(searchLower) ||
            order.id.toLowerCase().includes(searchLower)
        )
    })

    return (
        <Layout>
            <div className="order-container">
                <div className="order-header">
                    <h1>Manajemen Order</h1>
                </div>

                <div className="order-controls">
                    <div className="search-box">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Cari order (nama, produk, status)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <button onClick={fetchOrders} className="refresh-btn">
                        🔄 Refresh
                    </button>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="table-container">
                    <table className="order-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Tanggal</th>
                                <th>Pelanggan</th>
                                <th>Produk</th>
                                <th>Jumlah</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                                        Loading orders...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="empty-state">
                                        Belum ada order yang ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td style={{ fontFamily: 'monospace' }}>{order.id.slice(0, 8)}...</td>
                                        <td>{formatDate(order.created_at)}</td>
                                        <td>
                                            <div style={{ fontWeight: '600' }}>
                                                {order.customers?.full_name || order.customers?.push_name || 'Guest'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                {order.customer_phone}
                                            </div>
                                        </td>
                                        <td>{order.product?.NameProd || 'Unknown Product'}</td>
                                        <td style={{ textAlign: 'center' }}>{order.quantity}</td>
                                        <td style={{ fontWeight: '600', color: '#10b981' }}>
                                            {formatCurrency(order.total_amount)}
                                        </td>
                                        <td>
                                            <span className={`status-badge status-${order.status}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="detail-btn"
                                                onClick={() => alert(`Detail Order ID: ${order.id}\nStatus: ${order.status}\nEkspedisi: ${order.courier_company} - ${order.courier_service}`)}
                                            >
                                                📄 Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    )
}
