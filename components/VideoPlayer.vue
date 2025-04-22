<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted, nextTick, onBeforeUnmount, defineAsyncComponent, h } from 'vue'
import type { Caption, VideoInfo } from '~/types'
import { useCaptionsStore } from '~/stores/captions'
import { useSettingsStore } from '~/stores/settings'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import { useVideoControls } from '~/composables/useVideoControls'
import { useAnkiExtension } from '~/composables/useAnkiExtension'
import VideoControls from '~/components/video/VideoControls.vue'
import SettingsMenu from '~/components/video/SettingsMenu.vue'
import { useVideoUtils } from '~/composables/useVideoUtils'
import { useInputHandlers } from '~/composables/useInputHandlers'
import { useVideoPlayer } from '~/composables/useVideoPlayer'
import { useCaptionsControl } from '~/composables/useCaptionsControl'
import { useVideoMetadata } from '~/composables/useVideoMetadata'
import VideoJSPlayer from '~/components/VideoJSPlayer.vue'
import { loadSubtitleFile } from '~/utils/subtitleLoader'
import type { VideoJsPlayer } from 'video.js'

// Get utilities
const { createKeyboardHandler } = useInputHandlers()
const { formatTime, formatDuration } = useVideoUtils()

// Define props and emits
const props = defineProps<{
  videoUrl?: string | null
  captions: Caption[]
  currentTime: number
  onAudioTrackChange?: (track: number) => void
  videoAlignment?: 'left' | 'center' | 'right'
  playlist?: VideoInfo[]
  currentPlaylistIndex?: number
  poster?: string
}>()

const emit = defineEmits<{
  'timeupdate': [time: number]
  'error': [error: Error]
  'notify': [message: string]
  'audio-track-change': [track: number]
  'playing': []
  'pause': []
  'ended': []
  'toggle-captions': [visible: boolean]
  'subtitle-upload': [file: File]
  'toggle-captions-panel': [visible: boolean]
  'toggle-sidebar': [value: boolean]
  'back-to-list': []
  'play-video': [index: number]
  'next-video': []
  'previous-video': []
}>()

// Store and state
const store = useCaptionsStore()
const settings = useSettingsStore()
const videoControls = useVideoControls()
const ankiExtension = useAnkiExtension()

// Player state
const player = ref<VideoJsPlayer | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const videoDuration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isFullscreen = ref(false)
const subtitleTracks = ref<Array<{
  src: string;
  language: string;
  label?: string;
  format?: string;
  delay?: number;
}>>([])
const showSubtitles = ref(true)

// UI state
const isHovering = ref(false)
const lastMouseMoveTime = ref(Date.now())
const controlsHidden = ref(false)
const showControls = ref(true)
const showSettingsMenu = ref(false)
const sidebarActive = ref(false)
const sidebarMode = ref<'subtitles' | 'playlist'>('subtitles')

// Subtitle state
const activeSubtitleTrack = ref(0)
const fontSize = ref(1.0)
const subtitleDelay = ref(0)

// Playlist state
const playlist = computed(() => props.playlist || [])
const currentPlaylistIndex = computed(() => props.currentPlaylistIndex || 0)
const playlistLength = computed(() => playlist.value.length)
const isInPlaylist = computed(() => playlistLength.value > 0)
const hasNextVideo = computed(() => isInPlaylist.value && currentPlaylistIndex.value < playlistLength.value - 1)
const hasPreviousVideo = computed(() => isInPlaylist.value && currentPlaylistIndex.value > 0)

// Flickity options
const flickityOptions = {
  prevNextButtons: true,
  pageDots: false,
  wrapAround: false,
  cellAlign: 'left',
  contain: true,
  draggable: true,
  freeScroll: false,
  groupCells: true,
  adaptiveHeight: false,
  percentPosition: true,
  resize: true,
  setGallerySize: true,
  watchCSS: false
}

// Import Flickity only on client side
// Using a more robust approach with ClientOnly component
const flickityComponent = ref<typeof import('vue-flickity').default | null>(null)

// We'll use this flag to determine if we're on client-side
const isClient = ref(false)

// Set up Flickity on mount
onMounted(() => {
  if (process.client) {
    isClient.value = true
    // Import Flickity on client-side only
    import('vue-flickity').then(module => {
      flickityComponent.value = module.default
      // Allow time for component to be registered
      nextTick(() => {
        // Initialize Flickity after DOM is ready
        if (flickityRef.value && flickityRef.value.reloadCells) {
          flickityRef.value.reloadCells()
        }
      })
    }).catch(error => {
      console.error('Error loading vue-flickity:', error)
    })
  }
})

// Flickity instance
const flickityRef = ref<any>(null)

// Video source
const videoSource = computed(() => {
  return props.videoUrl || ''
})

// Navigation functions
function goBackToList() {
  emit('back-to-list')
}

function playNextVideo() {
  if (hasNextVideo.value) {
    emit('next-video')
  }
}

function playPreviousVideo() {
  if (hasPreviousVideo.value) {
    emit('previous-video')
  }
}

function playVideoFromPlaylist(index: number) {
  emit('play-video', index)
}

function togglePlaylistSidebar() {
  sidebarMode.value = 'playlist'
  toggleSidebar(true)
}

function setSidebarMode(mode: 'subtitles' | 'playlist') {
  sidebarMode.value = mode
  
  // Refresh Flickity when switching to subtitles mode
  if (mode === 'subtitles') {
    nextTick(() => {
      safeFlickityCall('reloadCells')
    })
  }
}

// Player event handlers
function onPlayerReady(playerInstance: any) {
  console.log('Player is ready')
}

function onPlay() {
  isPlaying.value = true
  emit('playing')
}

function onPause() {
  isPlaying.value = false
  emit('pause')
}

function onTimeUpdate(time: number) {
  currentTime.value = time
  emit('timeupdate', time)
}

function onEnded() {
  emit('ended')
}

function onError(error: Error) {
  emit('error', new Error(error.message || 'Video playback error'))
}

// Player controls
function togglePlayPause() {
  if (player.value) {
    if (isPlaying.value) {
      player.value.pause()
    } else {
      player.value.play()
    }
  }
}

function seek(time: number) {
  if (player.value) {
    player.value.currentTime(time)
  }
}

function handleVolumeChange(newVolume: number) {
  volume.value = newVolume
  if (player.value) {
    player.value.volume(newVolume)
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value
  if (player.value) {
    player.value.muted(isMuted.value)
  }
}

function toggleFullscreen() {
  if (player.value) {
    if (isFullscreen.value) {
      player.value.exitFullscreen()
    } else {
      player.value.requestFullscreen()
    }
    isFullscreen.value = !isFullscreen.value
  }
}

// Subtitle handling
async function handleSubtitleUpload(file: File) {
  try {
    const track = await loadSubtitleFile(file)
    subtitleTracks.value.push(track)
    emit('notify', `Loaded subtitle: ${file.name}`)
  } catch (error: any) {
    console.error('Error loading subtitle:', error)
    emit('error', new Error(`Failed to load subtitle: ${error.message}`))
  }
}

function handleToggleCaptions(visible: boolean) {
  showSubtitles.value = visible
  if (player.value) {
    const tracks = player.value.textTracks()
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = visible ? 'showing' : 'hidden'
    }
  }
  emit('toggle-captions', visible)
}

function handleToggleCaptionsPanel(visible: boolean) {
  emit('toggle-captions-panel', visible)
}

// Word click handler for dictionary lookup
function handleWordClick(word: string) {
  console.log(`Word clicked: ${word}`)
  // Implement dictionary lookup or Anki export
  if (ankiExtension.isExtensionAvailable) {
    // TODO: Implement lookupWord in ankiExtension
    console.log('Anki extension available, but lookupWord not implemented')
  }
}

// Mouse movement handler
function handleMouseMove() {
  isHovering.value = true
  lastMouseMoveTime.value = Date.now()
  
  // Hide controls after inactivity
  setTimeout(() => {
    if (Date.now() - lastMouseMoveTime.value > 3000) {
      isHovering.value = false
    }
  }, 3000)
}

// Toggle settings menu
function toggleSettingsMenu() {
  showSettingsMenu.value = !showSettingsMenu.value
}

// Load initial subtitles
onMounted(() => {
  // Convert existing captions to subtitle tracks
  if (props.captions && props.captions.length > 0) {
    // Create a blob URL for the captions
    const captionsText = convertCaptionsToSrt(props.captions)
    const blob = new Blob([captionsText], { type: 'application/x-subrip' })
    const url = URL.createObjectURL(blob)
    
    subtitleTracks.value.push({
      src: url,
      language: 'Default',
      format: 'srt'
    })
  }
})

// Clean up blob URLs on unmount
onUnmounted(() => {
  subtitleTracks.value.forEach(track => {
    if (track.src.startsWith('blob:')) {
      URL.revokeObjectURL(track.src)
    }
  })
})

// Helper to convert captions to SRT format
function convertCaptionsToSrt(captions: Caption[]) {
  return captions.map((caption, index) => {
    const startTime = formatSrtTime(caption.startTime)
    const endTime = formatSrtTime(caption.endTime)
    return `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n`
  }).join('\n')
}

// Format time for SRT
function formatSrtTime(seconds: number) {
  const date = new Date(seconds * 1000)
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const secs = date.getUTCSeconds().toString().padStart(2, '0')
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0')
  return `${hours}:${minutes}:${secs},${ms}`
}

// Toggle sidebar with animation
function toggleSidebar(value?: boolean) {
  sidebarActive.value = value !== undefined ? value : !sidebarActive.value;
  
  nextTick(() => {
    if (player.value) {
      player.value.play(); // Trigger resize
    }
    
    // Refresh Flickity when sidebar is opened
    if (sidebarActive.value && flickityRef.value && sidebarMode.value === 'subtitles') {
      setTimeout(() => {
        safeFlickityCall('reloadCells');
      }, 300);
    }
  });
  
  // Emit event
  emit('toggle-sidebar', sidebarActive.value);
}

// Set active subtitle track with animation
function setActiveSubtitleTrack(index: number) {
  activeSubtitleTrack.value = index
  if (player.value) {
    player.value.showTextTrack(index, true)
  }
  nextTick(() => {
    safeFlickityCall('select', index)
  })
}

// Toggle subtitle track visibility
function toggleSubtitleTrack(index: number) {
  if (activeSubtitleTrack.value === index) {
    activeSubtitleTrack.value = -1; // Hide all
    if (player.value) {
      player.value.showTextTrack(index, false);
    }
  } else {
    setActiveSubtitleTrack(index);
  }
}

// Adjust font size with animation
function adjustFontSize(increase: boolean) {
  fontSize.value = Math.max(0.5, Math.min(2.0, fontSize.value + (increase ? 0.1 : -0.1)));
  
  // Apply font size to subtitles
  const subtitleElements = document.querySelectorAll('.vjs-ass-subtitles, .vjs-text-track-display');
  subtitleElements.forEach(el => {
    (el as HTMLElement).style.fontSize = `${fontSize.value}em`;
  });
}

// Adjust subtitle delay
function adjustDelay(amount: number) {
  subtitleDelay.value = Math.max(-10, Math.min(10, subtitleDelay.value + amount));
  
  // Apply delay to current subtitle track
  if (player.value && activeSubtitleTrack.value >= 0) {
    // For ASS subtitles
    const assPlugin = player.value.player_?.ass;
    if (assPlugin) {
      assPlugin.delay = subtitleDelay.value;
    }
  }
}

// Add keyboard shortcut for navigation
function handleKeyDown(e: KeyboardEvent) {
  // Toggle sidebar with 'S' key
  if (e.key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    toggleSidebar();
  }
  
  // Navigation shortcuts
  if (e.key === 'Escape' && !isFullscreen.value) {
    goBackToList();
  } else if (e.key === 'ArrowLeft' && e.altKey) {
    playPreviousVideo();
  } else if (e.key === 'ArrowRight' && e.altKey) {
    playNextVideo();
  } else if (e.key === 'p' && e.altKey) {
    togglePlaylistSidebar();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// Function to safely call Flickity methods
function safeFlickityCall(method: string, ...args: any[]): void {
  // Make sure we're on client side and flickityRef exists
  if (process.client && isClient.value && flickityRef.value) {
    // Use nextTick to ensure Vue has updated the DOM
    nextTick(() => {
      try {
        // Check if the method exists on the flickityRef
        if (flickityRef.value && typeof flickityRef.value[method] === 'function') {
          (flickityRef.value[method] as Function)(...args)
        }
      } catch (e) {
        console.error(`Error calling Flickity method ${method}:`, e)
      }
    });
  }
}

// Playlist rendering
function renderPlaylistItem(video: VideoInfo) {
  return `
    <div class="playlist-item">
      <div class="thumbnail">
        ${video.thumbnail ? `<img src="${video.thumbnail}" alt="${video.title || ''}" />` : ''}
      </div>
      <div class="info">
        <div class="title">${video.title || video.path || ''}</div>
        <div class="duration">${video.duration ? formatDuration(video.duration) : ''}</div>
      </div>
    </div>
  `
}
</script>

<template>
  <div 
    class="player-container" 
    :class="{ 'sidebar-active': sidebarActive }"
  >
    <!-- Navigation bar -->
    <div class="navigation-bar">
      <button 
        class="nav-button back-button" 
        @click="goBackToList"
        title="Back to Video List"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        <span>Back</span>
      </button>
      
      <div class="playlist-controls">
        <button 
          class="nav-button prev-button" 
          @click="playPreviousVideo"
          :disabled="!hasPreviousVideo"
          title="Previous Video"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        
        <span class="playlist-info" v-if="isInPlaylist">
          {{ currentPlaylistIndex + 1 }} / {{ playlistLength }}
        </span>
        
        <button 
          class="nav-button next-button" 
          @click="playNextVideo"
          :disabled="!hasNextVideo"
          title="Next Video"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>
      
      <button 
        class="nav-button playlist-button" 
        @click="togglePlaylistSidebar"
        title="Show Playlist"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/>
        </svg>
        <span>Playlist</span>
      </button>
    </div>
    
    <div class="video-wrapper">
      <VideoJSPlayer
        ref="player"
        :src="videoSource"
        :subtitles="subtitleTracks"
        :width="1280"
        :height="720"
        :autoplay="false"
        :controls="true"
        :loop="false"
        :muted="false"
        :poster="props.poster || ''"
        :start-time="0"
        :playback-rates="[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]"
        :responsive="true"
        :fill="false"
        :language="'en'"
        :sidebar-active="sidebarActive"
        :show-sidebar-toggle="true"
        @ready="onPlayerReady"
        @play="onPlay"
        @pause="onPause"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @error="onError"
        @word-click="handleWordClick"
        @toggle-sidebar="toggleSidebar"
      />
      
      <!-- Use the VideoControls component -->
      <VideoControls 
        v-if="(showControls || isHovering) && !controlsHidden"
        :is-playing="isPlaying"
        :current-time="currentTime"
        :duration="videoDuration"
        :volume="volume"
        :is-muted="isMuted"
        :is-fullscreen="isFullscreen"
        :show-settings="showSettingsMenu"
        @play="togglePlayPause()"
        @pause="togglePlayPause()"
        @seek="seek"
        @volume-change="handleVolumeChange"
        @toggle-mute="toggleMute"
        @toggle-fullscreen="toggleFullscreen"
        @toggle-settings="toggleSettingsMenu"
        @toggle-captions="handleToggleCaptions($event)"
        @subtitle-upload="handleSubtitleUpload"
        @toggle-captions-panel="handleToggleCaptionsPanel($event)"
      />
    </div>
    
    <!-- Sidebar with animation -->
    <transition name="slide">
      <div v-if="sidebarActive" class="sidebar">
        <div class="sidebar-header">
          <h3>{{ sidebarMode === 'subtitles' ? 'Subtitles' : 'Playlist' }}</h3>
          <div class="sidebar-tabs">
            <button 
              class="sidebar-tab" 
              :class="{ 'active': sidebarMode === 'subtitles' }"
              @click="setSidebarMode('subtitles')"
            >
              Subtitles
            </button>
            <button 
              class="sidebar-tab" 
              :class="{ 'active': sidebarMode === 'playlist' }"
              @click="setSidebarMode('playlist')"
            >
              Playlist
            </button>
          </div>
          <button class="close-button" @click="toggleSidebar(false)">×</button>
        </div>
        
        <div class="sidebar-content">
          <!-- Subtitles content -->
          <div v-if="sidebarMode === 'subtitles'" class="subtitles-content">
            <!-- Subtitle tracks carousel with Flickity -->
            <div class="subtitle-tracks">
              <h4>Available Tracks</h4>
              <ClientOnly>
                <template v-if="isClient && flickityComponent?.value">
                  <component 
                    :is="flickityComponent.value"
                    ref="flickityRef"
                    :options="flickityOptions"
                    class="subtitle-carousel"
                  >
                  <div 
                    v-for="(track, index) in subtitleTracks" 
                    :key="index"
                    class="subtitle-track-item"
                    :class="{ 'active': activeSubtitleTrack === index }"
                    @click="setActiveSubtitleTrack(index)"
                  >
                    <div class="track-info">
                      <div class="track-name">{{ track.label || track.language }}</div>
                      <div class="track-language">{{ track.language }}</div>
                    </div>
                    <div class="track-actions">
                      <button 
                        class="track-toggle" 
                        :class="{ 'active': activeSubtitleTrack === index }"
                        @click.stop="toggleSubtitleTrack(index)"
                      >
                        {{ activeSubtitleTrack === index ? 'Hide' : 'Show' }}
                      </button>
                    </div>
                  </div>
                  </component>
                </template>
                <template #fallback>
                  <div class="subtitle-carousel-fallback">
                    <div 
                      v-for="(track, index) in subtitleTracks" 
                      :key="index"
                      class="subtitle-track-item"
                      :class="{ 'active': activeSubtitleTrack === index }"
                      @click="setActiveSubtitleTrack(index)"
                    >
                      <div class="track-info">
                        <div class="track-name">{{ track.label || track.language }}</div>
                        <div class="track-language">{{ track.language }}</div>
                      </div>
                      <div class="track-actions">
                        <button 
                          class="track-toggle" 
                          :class="{ 'active': activeSubtitleTrack === index }"
                          @click.stop="toggleSubtitleTrack(index)"
                        >
                          {{ activeSubtitleTrack === index ? 'Hide' : 'Show' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
              </ClientOnly>
            </div>
            
            <!-- Upload new subtitle with animation -->
            <div class="upload-subtitle">
              <h4>Add Subtitle</h4>
              <div class="upload-controls">
                <label class="upload-button">
                  <transition name="pulse" mode="in-out">
                    <span key="browse">Browse</span>
                  </transition>
                  <input 
                    type="file" 
                    accept=".srt,.vtt,.ass,.ssa"
                    @change="(e) => { 
                      const target = e.target as HTMLInputElement;
                      if (target.files?.length) {
                        handleSubtitleUpload(target.files[0]);
                      }
                    }"
                    hidden
                  >
                </label>
                <span class="upload-info">Supports SRT, VTT, ASS/SSA</span>
              </div>
            </div>
            
            <!-- Subtitle settings with animations -->
            <div class="subtitle-settings">
              <h4>Settings</h4>
              
              <div class="setting-item">
                <label>Font Size</label>
                <div class="setting-controls">
                  <button @click="adjustFontSize(false)" class="animated-button">-</button>
                  <transition name="fade" mode="out-in">
                    <span :key="fontSize">{{ fontSize.toFixed(1) }}</span>
                  </transition>
                  <button @click="adjustFontSize(true)" class="animated-button">+</button>
                </div>
              </div>
              
              <div class="setting-item">
                <label>Delay (seconds)</label>
                <div class="setting-controls">
                  <button @click="adjustDelay(-0.1)" class="animated-button">-</button>
                  <transition name="fade" mode="out-in">
                    <span :key="subtitleDelay">{{ subtitleDelay.toFixed(1) }}</span>
                  </transition>
                  <button @click="adjustDelay(0.1)" class="animated-button">+</button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Playlist content -->
          <div v-if="sidebarMode === 'playlist'" class="playlist-content">
            <div class="playlist-items">
              <div 
                v-for="(video, index) in playlist" 
                :key="index"
                class="playlist-item"
                :class="{ 'active': currentPlaylistIndex === index }"
                @click="playVideoFromPlaylist(index)"
              >
                <div class="playlist-item-number">{{ index + 1 }}</div>
                <div class="playlist-item-info">
                  <div class="playlist-item-name">{{ video.title || video.path || '' }}</div>
                  <div class="playlist-item-duration" v-if="video.duration">
                    {{ formatDuration(video.duration) }}
                  </div>
                </div>
                <div class="playlist-item-actions">
                  <button 
                    class="playlist-item-play" 
                    @click.stop="playVideoFromPlaylist(index)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
    
    <!-- Settings Menu component -->
    <SettingsMenu 
      :show="showSettingsMenu"
      @close="showSettingsMenu = false"
    />
  </div>
</template>

<style scoped>
/* Import the shared styles */
@import '@/assets/css/video-player.css';

.player-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  background-color: #000;
}

/* Navigation bar */
.navigation-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  z-index: 50;
  transition: opacity 0.3s ease;
}

.nav-button {
  background: rgba(43, 51, 63, 0.7);
  border: none;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: background 0.2s ease, transform 0.2s ease;
}

.nav-button:hover {
  background: rgba(43, 51, 63, 0.9);
  transform: translateY(-2px);
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.playlist-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.playlist-info {
  color: white;
  font-size: 14px;
}

/* Sidebar tabs */
.sidebar-tabs {
  display: flex;
  gap: 5px;
  margin-right: auto;
  margin-left: 15px;
}

.sidebar-tab {
  background: transparent;
  border: none;
  color: #aaa;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: color 0.2s ease, background 0.2s ease;
}

.sidebar-tab:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.sidebar-tab.active {
  color: white;
  background: rgba(96, 165, 250, 0.2);
  border-bottom: 2px solid #60a5fa;
}

/* Playlist items */
.playlist-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.playlist-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.playlist-item:hover {
  background: #333;
}

.playlist-item.active {
  background: #3a3a3a;
  border-left: 3px solid #60a5fa;
}

.playlist-item-number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #444;
  border-radius: 50%;
  margin-right: 10px;
  font-size: 12px;
}

.playlist-item-info {
  flex: 1;
}

.playlist-item-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.playlist-item-duration {
  font-size: 12px;
  color: #aaa;
}

.playlist-item-actions {
  display: flex;
  gap: 5px;
}

.playlist-item-play {
  width: 30px;
  height: 30px;
  background: #444;
  border: none;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.playlist-item-play:hover {
  background: #60a5fa;
  transform: scale(1.1);
}

/* Sidebar styles with animations */
.sidebar {
  width: 350px;
  background-color: #1a1a1a;
  color: #fff;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #333;
  box-shadow: -5px 0 15px rgba(0, 0, 0, 0.5);
}

/* Slide animation for sidebar */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Fade animation for values */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Pulse animation for buttons */
.pulse-enter-active {
  animation: pulse 0.3s;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #333;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-button {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.close-button:hover {
  transform: scale(1.2);
}

.sidebar-content {
  padding: 15px;
  flex: 1;
  overflow-y: auto;
}

.subtitle-tracks, .upload-subtitle, .subtitle-settings {
  margin-bottom: 20px;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #ccc;
}

/* Flickity carousel styles */
.subtitle-carousel {
  margin: 0 -15px;
  padding: 0 15px;
}

.subtitle-track-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
  margin-right: 10px;
  background-color: #2a2a2a;
  cursor: pointer;
  width: 250px;
  transition: all 0.2s ease;
}

.subtitle-track-item:hover {
  background-color: #333;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.subtitle-track-item.active {
  background-color: #3a3a3a;
  border-left: 3px solid #60a5fa;
}

.track-info {
  flex: 1;
}

.track-name {
  font-weight: 500;
}

.track-language {
  font-size: 12px;
  color: #aaa;
}

.track-actions {
  display: flex;
  gap: 5px;
}

.track-toggle {
  background-color: #444;
  border: none;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s ease;
}

.track-toggle:hover {
  background-color: #555;
}

.track-toggle.active {
  background-color: #60a5fa;
}

.upload-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-button {
  background-color: #60a5fa;
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: inline-block;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.upload-button:hover {
  background-color: #3b82f6;
  transform: translateY(-2px);
}

.upload-info {
  font-size: 12px;
  color: #aaa;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.setting-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-controls button {
  width: 30px;
  height: 30px;
  background-color: #444;
  border: none;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.setting-controls button:hover {
  background-color: #555;
  transform: scale(1.1);
}

.animated-button {
  position: relative;
  overflow: hidden;
}

.animated-button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0;
  border-radius: 100%;
  transform: scale(1, 1) translate(-50%, -50%);
  transform-origin: 50% 50%;
}

.animated-button:active::after {
  animation: ripple 0.6s ease-out;
}

@keyframes ripple {
  0% {
    transform: scale(0, 0);
    opacity: 0.5;
  }
  100% {
    transform: scale(20, 20);
    opacity: 0;
  }
}

/* Responsive styles */
@media (max-width: 768px) {
  .navigation-bar {
    height: 40px;
  }
  
  .nav-button span {
    display: none;
  }
  
  .playlist-item-name {
    max-width: 150px;
  }
}
</style>