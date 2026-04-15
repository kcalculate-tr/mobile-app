import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Branch, BranchUser } from '../types'

interface BranchContextValue {
  branch: Branch | null
  branchUser: BranchUser | null
  branchId: string | null
  loading: boolean
  logout: () => Promise<void>
}

const BranchContext = createContext<BranchContextValue>({
  branch: null,
  branchUser: null,
  branchId: null,
  loading: true,
  logout: async () => {},
})

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branch, setBranch] = useState<Branch | null>(null)
  const [branchUser, setBranchUser] = useState<BranchUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadBranchForUser(userId: string) {
    const { data: bu } = await supabase
      .from('branch_users')
      .select('*, branch:branches(*)')
      .eq('user_id', userId)
      .maybeSingle()

    if (bu) {
      setBranchUser(bu as BranchUser)
      setBranch((bu as any).branch as Branch)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadBranchForUser(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadBranchForUser(session.user.id)
      } else {
        setBranch(null)
        setBranchUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setBranch(null)
    setBranchUser(null)
  }

  return (
    <BranchContext.Provider value={{ branch, branchUser, branchId: branch?.id ?? null, loading, logout }}>
      {children}
    </BranchContext.Provider>
  )
}

export const useBranch = () => useContext(BranchContext)
