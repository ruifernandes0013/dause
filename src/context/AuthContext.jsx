import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const VALID_USERNAME = 'rui.fernandes'
const VALID_PASSWORD = 'Dause@2026!'

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => localStorage.getItem('rental_authed') === 'true')

  function login(username, password) {
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem('rental_authed', 'true')
      setAuthed(true)
      return true
    }
    return false
  }

  function logout() {
    localStorage.removeItem('rental_authed')
    setAuthed(false)
  }

  return (
    <AuthContext.Provider value={{ authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
