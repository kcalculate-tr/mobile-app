// src/hooks/usePopups.ts
// Supabase'den aktif pop-up'ları çeker, session başına bir kez gösterir
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

// React Native'de sessionStorage yok — uygulama yaşam döngüsü boyunca tutulur
let shownThisSession = false

export interface Popup {
  id: number
  title: string | null
  description: string | null
  image_url: string | null
  button_label: string | null
  button_link: string | null
  button_navigate_to: string | null
  order_index: number
}

export function usePopups() {
  const [popups, setPopups] = useState<Popup[]>([])
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (shownThisSession) return

    const fetchPopups = async () => {
      const supabase = getSupabaseClient()
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('popups')
        .select('id,title,description,image_url,button_label,button_link,button_navigate_to,order_index')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('order_index', { ascending: true })

      if (error || !data?.length) return

      setPopups(data)
      setIndex(0)
      setVisible(true)
    }

    fetchPopups()
  }, [])

  const handleClose = () => {
    setVisible(false)
    shownThisSession = true
  }

  const handleNext = () => {
    if (index < popups.length - 1) {
      setIndex(i => i + 1)
    } else {
      handleClose()
    }
  }

  return {
    popup: visible && popups.length > 0 ? popups[index] : null,
    total: popups.length,
    index,
    handleClose,
    handleNext,
  }
}
