import type { Caption } from '~/types'

export function useVideoUtils() {
  // Format time in MM:SS format
  function formatTime(seconds: number): string {
    const date = new Date(seconds * 1000)
    const hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const secs = date.getUTCSeconds()
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
  
  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
  
  // Generate WebVTT content from captions
  function generateWebVTT(captions: Caption[]): string {
    let vtt = 'WEBVTT\n\n'
    
    captions.forEach((caption, index) => {
      vtt += `${index + 1}\n`
      vtt += `${formatVTTTime(caption.startTime)} --> ${formatVTTTime(caption.endTime)}\n`
      vtt += `${caption.text}\n\n`
    })
    
    return vtt
  }
  
  // Format time for VTT format (HH:MM:SS.mmm)
  function formatVTTTime(seconds: number): string {
    const date = new Date(seconds * 1000)
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    const secs = date.getUTCSeconds().toString().padStart(2, '0')
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0')
    
    return `${hours}:${minutes}:${secs}.${ms}`
  }
  
  // Detect language from text
  function detectLanguage(text: string): string {
    // Simple language detection based on character ranges
    const japanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/
    const korean = /[\u3130-\u318F\uAC00-\uD7AF]/
    const chinese = /[\u4E00-\u9FFF]/
    
    if (japanese.test(text)) return 'ja'
    if (korean.test(text)) return 'ko'
    if (chinese.test(text)) return 'zh'
    return 'en'
  }
  
  return {
    formatTime,
    formatDuration,
    generateWebVTT,
    formatVTTTime,
    detectLanguage
  }
} 