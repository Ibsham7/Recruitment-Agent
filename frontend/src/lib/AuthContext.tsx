import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { UserProfile, UserProfileResponse } from './types'
import { apiFetch } from './api'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isAdmin: boolean
  isLoading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  isLoading: true,
  refreshProfile: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.access_token) {
      setProfile(null)
      setIsAdmin(false)
      return
    }
    try {
      const res = await apiFetch('/api/user/profile')
      if (res.ok) {
        const data = (await res.json()) as UserProfileResponse
        setProfile(data.profile || null)
        setIsAdmin(Boolean(data.isAdmin))
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to load user profile:', err)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data: { session: curSession } } = await supabase.auth.getSession()
    await fetchProfile(curSession)
  }, [fetchProfile])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session) {
        await fetchProfile(session)
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session) {
        await fetchProfile(session)
      } else {
        setProfile(null)
        setIsAdmin(false)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, isLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}
