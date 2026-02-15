import Sidebar from './Sidebar'

export default function Layout({ children }) {
    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                marginLeft: '260px',
                minHeight: '100vh',
                backgroundColor: '#f8fafc'
            }}>
                {children}
            </main>
        </div>
    )
}
