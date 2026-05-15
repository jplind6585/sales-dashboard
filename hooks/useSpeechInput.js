import { useState, useRef, useCallback } from 'react'

export function useSpeechInput() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const finalRef = useRef('')

  const supported = typeof window !== 'undefined'
    && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback((onResult, onError) => {
    if (!supported) {
      onError?.('Voice input requires Chrome or Edge. Try opening in Chrome.')
      return
    }
    finalRef.current = ''
    setTranscript('')

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'

    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalRef.current += e.results[i][0].transcript + ' '
        } else {
          interim = e.results[i][0].transcript
        }
      }
      setTranscript((finalRef.current + interim).trim())
    }

    r.onerror = (e) => {
      setListening(false)
      recognitionRef.current = null
      const msg = e.error === 'not-allowed'
        ? 'Microphone access denied. Click the lock icon in your browser address bar and allow microphone.'
        : e.error === 'no-speech'
        ? 'No speech detected. Try again.'
        : `Voice error: ${e.error}`
      onError?.(msg)
    }

    r.onend = () => {
      setListening(false)
      recognitionRef.current = null
      const final = finalRef.current.trim()
      if (final) onResult?.(final)
    }

    r.start()
    recognitionRef.current = r
    setListening(true)
  }, [supported])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { listening, transcript, start, stop, supported }
}
