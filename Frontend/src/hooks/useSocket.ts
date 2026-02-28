import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
function socketBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  const base = (API_BASE ?? '').replace(/\/$/, '')
  const withoutApi = base ? base.replace(/\/api\/?$/, '') : ''
  if (withoutApi && (withoutApi.startsWith('http://') || withoutApi.startsWith('https://'))) {
    return withoutApi
  }
  return window.location.origin
}

export type NewMessagePayload = {
  id: string
  conversationId: string
  sender: { _id: string; username?: string; email?: string }
  content: string
  createdAt: string
}

export type TypingPayload = {
  conversationId: string
  userId: string
  username?: string
}

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setSocket(null)
      return
    }
    const base = socketBaseUrl()
    const s = io(base, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = s
    s.on('connect', () => setSocket(s))
    s.on('disconnect', () => setSocket(null))
    if (s.connected) setSocket(s)
    return () => {
      s.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [token])

  const joinConversation = useCallback((conversationId: string) => {
    return new Promise<void>((resolve, reject) => {
      const s = socketRef.current
      if (!s) {
        reject(new Error('Socket not ready'))
        return
      }
      s.emit('join_conversation', conversationId, (err: string | null) => {
        if (err) reject(new Error(err))
        else resolve()
      })
    })
  }, [])

  const leaveConversation = useCallback((conversationId: string): void => {
    socketRef.current?.emit('leave_conversation', conversationId)
  }, [])

  const sendMessage = useCallback(
    (conversationId: string, content: string) => {
      return new Promise<NewMessagePayload>((resolve, reject) => {
        const s = socketRef.current
        if (!s) {
          reject(new Error('Socket not ready'))
          return
        }
        s.emit('send_message', { conversationId, content }, (err: string | null, data?: NewMessagePayload) => {
          if (err) reject(new Error(err))
          else if (data) resolve(data)
          else reject(new Error('No response'))
        })
      })
    },
    []
  )

  const typingStart = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_start', conversationId)
  }, [])

  const typingStop = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_stop', conversationId)
  }, [])

  return {
    joinConversation,
    leaveConversation,
    sendMessage,
    typingStart,
    typingStop,
    isConnected: !!socket?.connected,
    socket,
  }
}
