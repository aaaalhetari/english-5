// Kokoro-82M neural voice, run inside a Web Worker (background thread) so the
// page stays responsive. First use downloads the model once and the browser
// caches it; switching voices does not re-download the model.

export const VOICE_OPTIONS = [
  { id: 'af_heart', label: 'Heart (US, female) — grade A' },
  { id: 'af_bella', label: 'Bella (US, female) — grade A-' },
  { id: 'bf_emma', label: 'Emma (UK, female) — grade B-' },
  { id: 'am_fenrir', label: 'Fenrir (US, male) — grade C+' },
  { id: 'am_michael', label: 'Michael (US, male) — grade C+' }
]

// shared state across all popups
const selectedVoice = useLocalStorage<string>('vocab_app_voice_id', 'af_heart')
const downloading = ref(false)
const downloadProgress = ref(0)
const speaking = ref(false)
let worker: Worker | null = null
let workerBroken = false
let nextId = 1
const pending = new Map<number, (blob: Blob | null) => void>()
const audioCache = new Map<string, string>() // `${voice}|${word}` -> object URL

function getWorker(): Worker | null {
  if (workerBroken) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('../workers/tts.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'loading') downloading.value = true
      else if (m.type === 'progress') { downloading.value = true; downloadProgress.value = m.value }
      else if (m.type === 'ready') downloading.value = false
      else if (m.type === 'audio' || m.type === 'error') {
        downloading.value = false
        const resolve = pending.get(m.id)
        pending.delete(m.id)
        resolve?.(m.type === 'audio' ? m.blob : null)
      }
    }
    worker.onerror = () => {
      workerBroken = true
      downloading.value = false
      pending.forEach(r => r(null))
      pending.clear()
    }
    return worker
  } catch {
    workerBroken = true
    return null
  }
}

function speakFallback(word: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

function play(url: string) {
  const player = new Audio(url)
  speaking.value = true
  player.onended = () => (speaking.value = false)
  player.onerror = () => (speaking.value = false)
  player.play().catch(() => (speaking.value = false))
}

export function useTTS() {
  async function speak(word: string) {
    const key = `${selectedVoice.value}|${word}`
    const cached = audioCache.get(key)
    if (cached) return play(cached)

    const w = getWorker()
    if (!w) return speakFallback(word)

    const id = nextId++
    const blob = await new Promise<Blob | null>(resolve => {
      pending.set(id, resolve)
      w.postMessage({ id, text: word, voice: selectedVoice.value })
    })
    if (!blob) return speakFallback(word)
    const url = URL.createObjectURL(blob)
    audioCache.set(key, url)
    play(url)
  }

  return { speak, downloading, downloadProgress, speaking, selectedVoice, voiceOptions: VOICE_OPTIONS }
}
