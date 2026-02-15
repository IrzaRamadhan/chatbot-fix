import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import '../styles/ProductManagement.css'

export default function ProductManagement() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        stock: '',
        weight: ''
    })

    useEffect(() => {
        fetchProducts()
    }, [])

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('product')
                .select('*')
                .order('"Created_at"', { ascending: false })

            if (error) throw error
            setProducts(data || [])
        } catch (err) {
            setError(err.message)
            console.error('Error fetching products:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return

        try {
            const { error } = await supabase
                .from('product')
                .delete()
                .eq('IDprod', id)

            if (error) throw error
            fetchProducts()
        } catch (err) {
            alert('Error deleting product: ' + err.message)
        }
    }

    const handleEdit = (product) => {
        setEditingProduct(product)
        setFormData({
            name: product.NameProd || '',
            price: product.PriceProd || '',
            description: product.DescProd || '',
            stock: product.StockProd || '',
            weight: product.WeightProd || ''
        })
        setShowModal(true)
    }

    const handleAdd = () => {
        setEditingProduct(null)
        setFormData({
            name: '',
            price: '',
            description: '',
            stock: '',
            weight: ''
        })
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const productData = {
            NameProd: formData.name,
            PriceProd: formData.price,
            DescProd: formData.description,
            StockProd: formData.stock,
            IsActive: true,
            WeightProd: formData.weight || 1000,
            Updated_at: new Date().toISOString()
        }

        try {
            if (editingProduct) {
                // Update existing product
                const { error } = await supabase
                    .from('product')
                    .update(productData)
                    .eq('IDprod', editingProduct.IDprod)

                if (error) throw error
            } else {
                // Add new product - Manual ID generation to bypass sequence issues
                // Find the highest current ID
                const maxId = products.length > 0
                    ? Math.max(...products.map(p => p.IDprod || 0))
                    : 0

                const newProductData = {
                    ...productData,
                    IDprod: maxId + 1,
                    Created_at: new Date().toISOString()
                }

                const { error } = await supabase
                    .from('product')
                    .insert([newProductData])

                if (error) throw error
            }

            setShowModal(false)
            fetchProducts()
        } catch (err) {
            alert('Error saving product: ' + err.message)
        }
    }

    const filteredProducts = products.filter(product =>
        product.NameProd?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.DescProd?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <Layout>
                <div className="product-container">
                    <div className="loading-spinner">Loading...</div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <div className="product-container">
                <div className="product-header">
                    {/* Back button removed - handled by Sidebar */}
                    <h1>Manajemen Produk</h1>
                </div>

                <div className="product-controls">
                    <div className="search-box">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Cari produk..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>


                    <button onClick={handleAdd} className="add-btn">
                        + Tambah Produk
                    </button>
                </div>

                <div className="table-container">
                    <table className="product-table">
                        <thead>
                            <tr>
                                <th>Nama Produk</th>
                                <th>Harga</th>
                                <th>Berat (gram)</th>
                                <th>Deskripsi</th>
                                <th>Stok</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="empty-state">
                                        {searchTerm ? 'Tidak ada produk yang ditemukan' : 'Belum ada produk'}
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.IDProd}>
                                        <td className="product-name">{product.NameProd}</td>
                                        <td className="product-price">Rp {Number(product.PriceProd || 0).toLocaleString('id-ID')}</td>
                                        <td className="product-weight">{product.WeightProd || '-'} g</td>
                                        <td className="product-desc">{product.DescProd}</td>
                                        <td className="product-stock">
                                            <span className={`stock-badge ${product.StockProd > 0 ? 'in-stock' : 'out-stock'}`}>
                                                {product.StockProd || 0}
                                            </span>
                                        </td>
                                        <td className="product-actions">
                                            <button onClick={() => handleEdit(product)} className="edit-btn">Edit</button>
                                            <button onClick={() => handleDelete(product.IDprod)} className="delete-btn">Hapus</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h2>{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h2>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Nama Produk</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Harga</label>
                                    <input
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        required
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Deskripsi</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows="3"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Stok</label>
                                    <input
                                        type="number"
                                        value={formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                        required
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Berat (gram)</label>
                                    <input
                                        type="number"
                                        value={formData.weight}
                                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                        required
                                        placeholder="Contoh: 1000"
                                        className="form-input"
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">
                                        Batal
                                    </button>
                                    <button type="submit" className="submit-btn">
                                        {editingProduct ? 'Update' : 'Tambah'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
