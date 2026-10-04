import { useEffect, useRef } from 'react'

export const REALTIME_CHANGE_EVENT = 'salesia:server-update'

export function useRealtimeRefresh(refresh: () => void | Promise<void>): void {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    const handleChange = () => { void refreshRef.current() }
    window.addEventListener(REALTIME_CHANGE_EVENT, handleChange)
    return () => window.removeEventListener(REALTIME_CHANGE_EVENT, handleChange)
  }, [])
}
