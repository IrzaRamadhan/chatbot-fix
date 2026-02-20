import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/Sidebar.css'

export default function Sidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { signOut } = useAuth()

    const isActive = (path) => {
        return location.pathname === path ? 'active' : ''
    }

    const handleLogout = async () => {
        try {
            await signOut()
            navigate('/login')
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="brand-icon">🤖</div>
                <h2>Bot Admin</h2>
            </div>

            <nav className="sidebar-nav">
                <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
                    <span className="icon">📊</span>
                    Dashboard
                </Link>
                <Link to="/config" className={`nav-link ${isActive('/config')}`}>
                    <span className="icon">⚙️</span>
                    Konfigurasi
                </Link>
                <Link to="/products" className={`nav-link ${isActive('/products')}`}>
                    <span className="icon">📦</span>
                    Produk
                </Link>
                <Link to="/orders" className={`nav-link ${isActive('/orders')}`}>
                    <span className="icon">🛍️</span>
                    Order
                </Link>
                <Link to="/customers" className={`nav-link ${isActive('/customers')}`}>
                    <span className="icon">👥</span>
                    Customer
                </Link>
            </nav>

            <div className="sidebar-footer">
                <button onClick={handleLogout} className="logout-btn">
                    <span className="icon">🚪</span>
                    Logout
                </button>
            </div>
        </aside>
    )
}
