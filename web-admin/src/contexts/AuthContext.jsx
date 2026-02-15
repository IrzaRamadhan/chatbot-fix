import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check if user is logged in from localStorage
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
            setUser(JSON.parse(savedUser))
        }
        setLoading(false)
    }, [])

    const signIn = async (username, password) => {
        try {
            console.log('Attempting login with:', username, password)

            // Query tabel user - coba dengan Username dulu
            const { data: userData, error: userError } = await supabase
                .from('user')
                .select('*')
                .eq('Username', username)
                .limit(1)

            console.log('Query by Username result:', userData, userError)

            // Jika tidak ketemu, coba dengan Email
            if (!userData || userData.length === 0) {
                const { data: emailData, error: emailError } = await supabase
                    .from('user')
                    .select('*')
                    .eq('Email', username)
                    .limit(1)

                console.log('Query by Email result:', emailData, emailError)

                if (emailError) {
                    throw emailError
                }

                if (!emailData || emailData.length === 0) {
                    throw new Error('User tidak ditemukan')
                }

                // Check password
                if (emailData[0].Password !== password) {
                    throw new Error('Password salah')
                }

                const loggedUser = {
                    username: emailData[0].Username,
                    email: emailData[0].Email,
                }

                setUser(loggedUser)
                localStorage.setItem('user', JSON.stringify(loggedUser))
                return { user: loggedUser }
            }

            if (userError) {
                throw userError
            }

            // Check password
            if (userData[0].Password !== password) {
                throw new Error('Password salah')
            }

            // Login berhasil
            const loggedUser = {
                username: userData[0].Username,
                email: userData[0].Email,
            }

            setUser(loggedUser)
            localStorage.setItem('user', JSON.stringify(loggedUser))

            return { user: loggedUser }
        } catch (error) {
            console.error('Login error detail:', error)
            throw error
        }
    }

    const signOut = async () => {
        setUser(null)
        localStorage.removeItem('user')
    }

    const value = {
        user,
        loading,
        signIn,
        signOut,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
