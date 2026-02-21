import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import '../styles/FollowUpConfig.css'

export default function FollowUpConfig() {
    const [configs, setConfigs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({
        session_type: 'idle',
        session_stage: '',
        ai_instruction: '',
        delay_seconds: 300,
        is_active: true
    })

    useEffect(() => { fetchConfigs() }, [])

    const fetchConfigs = async () => {
        try {
            setLoading(true)
            const { data, error: fetchError } = await supabase
                .from('followup_config')
                .select('*')
                .order('session_type')
            if (fetchError) throw fetchError
            setConfigs(data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('followup_config')
                    .update(form)
                    .eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('followup_config')
                    .insert([form])
                if (error) throw error
            }
            resetForm()
            fetchConfigs()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleEdit = (config) => {
        setForm({
            session_type: config.session_type,
            session_stage: config.session_stage || '',
            ai_instruction: config.ai_instruction,
            delay_seconds: config.delay_seconds,
            is_active: config.is_active
        })
        setEditingId(config.id)
        setShowForm(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Hapus konfigurasi ini?')) return
        try {
            const { error } = await supabase
                .from('followup_config')
                .delete()
                .eq('id', id)
            if (error) throw error
            fetchConfigs()
        } catch (err) {
            setError(err.message)
        }
    }

    const toggleActive = async (id, currentState) => {
        try {
            const { error } = await supabase
                .from('followup_config')
                .update({ is_active: !currentState })
                .eq('id', id)
            if (error) throw error
            fetchConfigs()
        } catch (err) {
            setError(err.message)
        }
    }

    const resetForm = () => {
        setForm({ session_type: 'idle', session_stage: '', ai_instruction: '', delay_seconds: 300, is_active: true })
        setEditingId(null)
        setShowForm(false)
    }

    const formatDelay = (seconds) => {
        if (seconds < 60) return `${seconds} detik`
        return `${Math.floor(seconds / 60)} menit`
    }

    const sessionTypeOptions = [
        { value: 'idle', label: '💤 Idle' },
        { value: 'ongkir', label: '🛒 Order (Ongkir)' },
        { value: 'cs', label: '💬 Chat CS' }
    ]

    const stageOptions = {
        idle: [{ value: '', label: '(Semua)' }],
        ongkir: [
            { value: 'parse_form', label: 'Isi Form Pesanan' },
            { value: 'select_courier', label: 'Pilih Kurir' },
            { value: 'review_order', label: 'Review Pesanan' },
            { value: 'waiting_payment', label: 'Menunggu Pembayaran' },
            { value: 'waiting_admin_confirm', label: 'Menunggu Verifikasi Admin' }
        ],
        cs: [{ value: 'active', label: 'CS Aktif' }]
    }

    return (
        <Layout>
            <div className="followup-container">
                <div className="followup-header">
                    <h1>⏰ Konfigurasi Follow-Up</h1>
                    <button className="add-btn" onClick={() => { resetForm(); setShowForm(true) }}>
                        + Tambah
                    </button>
                </div>

                {error && <div className="error-banner">{error} <button onClick={() => setError(null)}>✕</button></div>}

                {showForm && (
                    <div className="form-card">
                        <h3>{editingId ? '✏️ Edit Konfigurasi' : '➕ Tambah Konfigurasi'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Session</label>
                                    <select value={form.session_type} onChange={(e) => setForm({ ...form, session_type: e.target.value, session_stage: '' })}>
                                        {sessionTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Stage</label>
                                    <select value={form.session_stage} onChange={(e) => setForm({ ...form, session_stage: e.target.value })}>
                                        {(stageOptions[form.session_type] || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Delay (detik)</label>
                                    <input type="number" value={form.delay_seconds} onChange={(e) => setForm({ ...form, delay_seconds: parseInt(e.target.value) || 300 })} min="30" max="3600" />
                                </div>
                            </div>
                            <div className="form-group full">
                                <label>Instruksi AI</label>
                                <textarea value={form.ai_instruction} onChange={(e) => setForm({ ...form, ai_instruction: e.target.value })} placeholder="Contoh: Ingatkan customer untuk memilih jumlah pesanan..." rows={3} required />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="save-btn">{editingId ? 'Update' : 'Simpan'}</button>
                                <button type="button" className="cancel-btn" onClick={resetForm}>Batal</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="table-container">
                    <table className="followup-table">
                        <thead>
                            <tr>
                                <th>Session</th>
                                <th>Stage</th>
                                <th>Instruksi AI</th>
                                <th>Delay</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
                            ) : configs.length === 0 ? (
                                <tr><td colSpan="6" className="empty-state">Belum ada konfigurasi follow-up.</td></tr>
                            ) : (
                                configs.map(c => (
                                    <tr key={c.id} className={!c.is_active ? 'row-disabled' : ''}>
                                        <td>
                                            <span className={`type-badge type-${c.session_type}`}>
                                                {c.session_type === 'idle' ? '💤 Idle' : c.session_type === 'ongkir' ? '🛒 Order' : '💬 CS'}
                                            </span>
                                        </td>
                                        <td className="stage-cell">{c.session_stage || '-'}</td>
                                        <td className="instruction-cell">{c.ai_instruction}</td>
                                        <td>{formatDelay(c.delay_seconds)}</td>
                                        <td>
                                            <button className={`toggle-btn ${c.is_active ? 'active' : 'inactive'}`} onClick={() => toggleActive(c.id, c.is_active)}>
                                                {c.is_active ? '✅ Aktif' : '❌ Nonaktif'}
                                            </button>
                                        </td>
                                        <td className="action-cell">
                                            <button className="edit-btn" onClick={() => handleEdit(c)}>✏️</button>
                                            <button className="delete-btn" onClick={() => handleDelete(c.id)}>🗑️</button>
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
