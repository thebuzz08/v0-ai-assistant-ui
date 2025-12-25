"use client"

import { useCallback, useRef, useState } from "react"

interface UseAudioRecorderProps {
  onAudioChunk?: (blob: Blob, mimeType: string) => void
  chunkInterval?: number
}

export function useAudioRecorder({ onAudioChunk, chunkInterval = 1500 }: UseAudioRecorderProps = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mimeTypeRef = useRef<string>("audio/webm")

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      streamRef.current = stream

      let mimeType = "audio/webm"
      if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4"
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus"
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm"
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus"
      }
      mimeTypeRef.current = mimeType

      console.log("[v0] Using audio mime type:", mimeType)

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(200)
      setIsRecording(true)

      intervalRef.current = setInterval(() => {
        if (chunksRef.current.length > 0 && onAudioChunk) {
          const audioBlob = new Blob(chunksRef.current, { type: mimeType })
          // Only send if there's enough audio data
          if (audioBlob.size > 5000) {
            onAudioChunk(audioBlob, mimeType)
          }
          chunksRef.current = []
        }
      }, chunkInterval)

      return true
    } catch (error) {
      console.error("Failed to start recording:", error)
      return false
    }
  }, [onAudioChunk, chunkInterval])

  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (chunksRef.current.length > 0 && onAudioChunk) {
      const audioBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
      if (audioBlob.size > 1000) {
        onAudioChunk(audioBlob, mimeTypeRef.current)
      }
      chunksRef.current = []
    }

    mediaRecorderRef.current = null
    setIsRecording(false)
  }, [onAudioChunk])

  return {
    isRecording,
    startRecording,
    stopRecording,
  }
}
