import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { createAgoraCast, type AgoraCast } from '../../lib/api'

const MAX_CAST_IMAGES = 4

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Failed to read image'))
    r.readAsDataURL(file)
  })
}

export interface CastModalProps {
  open: boolean
  onClose: () => void
  token: string | null
  onSuccess?: (post: AgoraCast) => void
  /** Pre-fill the cast textarea (e.g. when navigating from Trendcraft) */
  initialContent?: string | null
}

export default function CastModal({ open, onClose, token, onSuccess, initialContent }: CastModalProps) {
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && initialContent != null && initialContent.trim()) {
      setContent(initialContent.trim())
    }
    if (open) setImages([])
  }, [open, initialContent])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const toAdd = Math.min(files.length, MAX_CAST_IMAGES - images.length)
    if (toAdd <= 0) return
    setError(null)
    try {
      const dataUrls: string[] = []
      for (let i = 0; i < toAdd && i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        dataUrls.push(await fileToDataUrl(file))
      }
      setImages((prev) => [...prev, ...dataUrls].slice(0, MAX_CAST_IMAGES))
    } catch {
      setError('Failed to add image')
    }
    e.target.value = ''
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed || !token) return
    setError(null)
    setLoading(true)
    const res = await createAgoraCast(token, {
      content: trimmed,
      ...(images.length ? { images } : {}),
    })
    setLoading(false)
    if (res.success && res.data?.post) {
      setContent('')
      setImages([])
      onSuccess?.(res.data.post)
      onClose()
    } else {
      setError(res.message ?? 'Failed to cast')
    }
  }

  function handleClose() {
    if (!loading) {
      setContent('')
      setImages([])
      setError(null)
      onClose()
    }
  }

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0f14] p-6 shadow-xl"
        >
          <h2 className="text-xl font-bold text-white mb-4">Create Cast</h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Cast it..."
            rows={4}
            maxLength={500}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            disabled={loading}
          />
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 max-w-md">
              {images.map((src, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 aspect-square group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/80"
                    aria-label="Remove image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || images.length >= MAX_CAST_IMAGES}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Add image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              </svg>
            </button>
            {images.length < MAX_CAST_IMAGES && (
              <span className="text-white/40 text-sm">
                {images.length}/{MAX_CAST_IMAGES} images
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-white/40 text-sm">{content.length}/500</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-white/80 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!content.trim() && images.length === 0) || loading}
                className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? 'Casting...' : 'Cast'}
              </button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
