import React, { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PwaLifecycle() {
  const shouldReloadRef = useRef(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({ immediate: true })

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.update())
    })
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined
    }

    const handleControllerChange = () => {
      if (!shouldReloadRef.current) return
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const handleApplyUpdate = async () => {
    try {
      setIsUpdating(true)
      shouldReloadRef.current = true
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      } else {
        await updateServiceWorker(true)
      }
      window.setTimeout(() => {
        if (shouldReloadRef.current) {
          window.location.reload()
        }
      }, 1200)
    } catch (error) {
      shouldReloadRef.current = false
      console.error('PWA güncellemesi uygulanamadı:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  if (!needRefresh && !offlineReady) {
    return null
  }

  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-brand-white/15 bg-[#F0F0F0] px-4 py-3 text-sm text-brand-dark shadow-2xl">
      <div className="flex items-center gap-3">
        <span>{needRefresh ? 'Yeni sürüm hazır' : 'Uygulama çevrimdışı kullanıma hazır'}</span>
        {needRefresh && (
          <button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="rounded-lg border border-brand-white/20 bg-[#98CD00] px-3 py-1.5 text-xs font-semibold text-[#F0F0F0] disabled:opacity-70"
          >
            {isUpdating ? 'Güncelleniyor...' : 'Güncelle'}
          </button>
        )}
        <button
          onClick={() => (needRefresh ? setNeedRefresh(false) : setOfflineReady(false))}
          className="rounded-lg bg-brand-white/10 px-3 py-1.5 text-xs font-semibold text-brand-dark/70"
        >
          Kapat
        </button>
      </div>
    </div>
  )
}
