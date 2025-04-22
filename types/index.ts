export interface Token {
  surface_form: string
  basic_form: string
  reading: string
  pos: string
}

export interface VideoInfo {
  name?: string        // For backward compatibility
  title?: string       // For display
  path?: string        // Path or URL
  size?: number        // File size
  lastModified?: number // Timestamp
  duration?: number    // Video duration in seconds
  url?: string         // URL for direct access
  thumbnail?: string   // URL to thumbnail
  thumbnailUrl?: string // Alias for thumbnail (for backward compatibility)
  subtitles?: string[] // List of subtitle file URLs
  isDirectory?: boolean // Is this a directory/folder
  children?: VideoInfo[] // For directory structure
}

export interface Tokenizer {
  tokenize(text: string): Token[]
}

export interface Caption {
  id: string
  startTime: number
  endTime: number
  text: string
  furigana?: Array<[string, string]>
  tokens?: Token[]
  lane?: number
  isActive?: boolean
  customOffset?: number | null
  minCustomOffset?: number | null
}

export interface SubtitleTrack {
  captions: Caption[]
  metadata: {
    language: string
    title: string
  }
}

export interface CaptionsState {
  captions: Caption[]
  currentTime: number
  activeCaptionIds: string[]
  customOffsets: Record<string, number>
  isAutoPauseMode: boolean
  isOffsetMode: boolean
}

interface Settings {
  videoAlignment: 'left' | 'center' | 'right'
  showVideoControls: boolean
  subtitleFontSize: number
  regexReplacements: RegexReplacement[]
  regexReplacementsEnabled: boolean
}

interface RegexReplacement {
  regex: string
  replaceText: string
}

export interface VideoUtils {
  formatTime: (seconds: number) => string
  formatDuration: (seconds: number) => string
  generateWebVTT: (captions: Caption[]) => string
  formatVTTTime: (seconds: number) => string
  detectLanguage: (text: string) => string
} 