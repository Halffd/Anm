<template>
  <div
    class="video-container"
    ref="videoContainer"
    :class="{ 'sidebar-active': sidebarActive }"
  >
    <!-- Debug indicator -->
    <div v-if="debugMode" class="debug-overlay">
      Size: {{ containerSize.width }}x{{ containerSize.height }}
    </div>

    <video
      ref="videoElement"
      class="video-js vjs-default-skin vjs-big-play-centered"
      controls
      preload="auto"
      :width="width"
      :height="height"
    ></video>

    <!-- Custom sidebar toggle button -->
    <button
      v-if="showSidebarToggle"
      class="vjs-sidebar-toggle"
      @click="toggleSidebar"
      :title="sidebarActive ? 'Hide Sidebar' : 'Show Sidebar'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path v-if="sidebarActive" fill="currentColor" d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H5V5h14v14zM7 16h10v-2H7v2zm0-4h10v-2H7v2zm0-4h10V6H7v2z"/>
        <path v-else fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type { VideoJsPlayer } from 'video.js';

// Define props
const props = defineProps<{
  src: string;
  subtitles: Array<{
    src: string;
    language: string;
    label?: string;
    format?: string;
    delay?: number;
  }>;
  width: number;
  height: number;
  autoplay: boolean;
  controls: boolean;
  loop: boolean;
  muted: boolean;
  poster: string;
  startTime: number;
  playbackRates: number[];
  responsive: boolean;
  fill: boolean;
  language: string;
  showSidebarToggle: boolean;
  sidebarActive: boolean;
}>();

// Define emits
const emit = defineEmits<{
  ready: [methods: typeof playerMethods];
  play: [];
  pause: [];
  timeupdate: [time: number];
  ended: [];
  error: [error: Error];
  'word-click': [word: string];
  'subtitle-change': [trackId: number];
  'audio-track-change': [trackId: number];
  'fullscreen-change': [isFullscreen: boolean];
  'volume-change': [{ volume: number; muted: boolean }];
  'toggle-sidebar': [active: boolean];
}>();

// Refs
const videoContainer = ref<HTMLDivElement | null>(null);
const videoElement = ref<HTMLVideoElement | null>(null);
const player = ref<VideoJsPlayer | null>(null);
const subtitleObserver = ref<MutationObserver | null>(null);

// Define debug mode for troubleshooting
const debugMode = ref(true);
const containerSize = ref({ width: 0, height: 0 });

// Toggle sidebar
function toggleSidebar() {
  emit('toggle-sidebar', !props.sidebarActive);
}

// Methods exposed to parent
const playerMethods = {
  play: () => player.value?.play(),
  pause: () => player.value?.pause(),
  currentTime: (time?: number) => {
    if (time !== undefined) {
      player.value?.currentTime(time);
    }
    return player.value?.currentTime();
  },
  volume: (level?: number) => {
    if (level !== undefined) {
      player.value?.volume(level);
    }
    return player.value?.volume();
  },
  muted: (muted?: boolean) => {
    if (muted !== undefined) {
      player.value?.muted(muted);
    }
    return player.value?.muted();
  },
  requestFullscreen: () => player.value?.requestFullscreen(),
  exitFullscreen: () => player.value?.exitFullscreen(),
  isFullscreen: () => player.value?.isFullscreen(),
  duration: () => player.value?.duration(),
  dispose: () => player.value?.dispose(),
  textTracks: () => player.value?.textTracks(),
  audioTracks: () => player.value?.audioTracks(),
  playbackRate: (rate?: number) => {
    if (rate !== undefined) {
      player.value?.playbackRate(rate);
    }
    return player.value?.playbackRate();
  },
  showTextTrack: (trackId: number, show: boolean) => {
    const tracks = player.value?.textTracks();
    if (tracks) {
      for (let i = 0; i < tracks.length; i++) {
        if (i === trackId) {
          tracks[i].mode = show ? 'showing' : 'hidden';
        } else {
          tracks[i].mode = 'hidden';
        }
      }
    }
  },
  width: () => 1920,
  height: () => 1080,
  toggleSidebar
};

// Initialize Video.js player
onMounted(() => {
  console.log('[VideoJSPlayer] onMounted - Starting player initialization');

  // Check if video.js is available
  if (typeof videojs === 'undefined') {
    console.error('[VideoJSPlayer] video.js is not loaded');
    emit('error', new Error('Video.js library is not loaded'));
    return;
  }

  // Ensure container exists
  const videoContainerElement = videoContainer.value;
  if (!videoContainerElement) {
    console.error('[VideoJSPlayer] Video container element is null');
    return;
  }

  // Log container dimensions
  const containerWidth = videoContainerElement.clientWidth;
  const containerHeight = videoContainerElement.clientHeight;
  console.log(`[VideoJSPlayer] Container dimensions: ${containerWidth}x${containerHeight}`);

  console.log('[CRITICAL] Video source value:', props.src);
  // Validate video source
  if (!props.src) {
    console.error('[VideoJSPlayer] No video source provided');
    return;
  }

  console.log(`[VideoJSPlayer] Video source: ${props.src}`);

  // Find the video element
  const videoElementRef = videoElement.value;
  if (!videoElementRef) {
    console.error('[VideoJSPlayer] Video element is null');
    return;
  }

  // Ensure video element is properly initialized
  if (!(videoElementRef instanceof HTMLVideoElement)) {
    console.error('[VideoJSPlayer] Video element is not an HTMLVideoElement');
    return;
  }

  // Force layout recalculation
  void videoElementRef.offsetHeight;

  // Clear any existing players
  if (player.value) {
    console.log('[VideoJSPlayer] Disposing existing player');
    player.value.dispose();
    player.value = null;
  }

  try {
    console.log('[VideoJSPlayer] Creating new VideoJS player instance');

    // Initialize the player with explicit dimensions
    const options = {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      responsive: true,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      width: containerWidth || 640,
      height: containerHeight || 360,
      sources: [{
        src: props.src,
        type: 'video/mp4'
      }]
    };

    console.log('[VideoJSPlayer] Player options:', options);

    // Create player instance
    player.value = videojs(videoElementRef, options);

    // Add source error handler
    player.value.on('error', (event: Event) => {
      const error = player.value?.error();
      console.error('[VideoJSPlayer] Source error:', error);
      if (error) {
        console.error('[VideoJSPlayer] Error code:', error.code);
        console.error('[VideoJSPlayer] Error message:', error.message);
      }
    });

    // Add source loaded handler
    player.value.on('loadedmetadata', () => {
      console.log('[VideoJSPlayer] Source metadata loaded');
      if (videoElementRef) {
        console.log('[VideoJSPlayer] Video dimensions:', videoElementRef.videoWidth, 'x', videoElementRef.videoHeight);
      }
    });

    // Add source loading handler
    player.value.on('loadstart', () => {
      console.log('[VideoJSPlayer] Starting to load video source');
    });

    // Add source loaded handler
    player.value.on('loadeddata', () => {
      console.log('[VideoJSPlayer] First frame of video loaded');
    });

    // Set up the ready event handler
    player.value.on('ready', () => {
      console.log('[VideoJSPlayer] Player is ready!');
      console.log(`[VideoJSPlayer] Player dimensions: ${playerMethods.width()}x${playerMethods.height()}`);

      // Update UI to show player is ready
      if (debugMode.value && videoContainer.value) {
        const debugEl = document.createElement('div');
        debugEl.className = 'player-ready-indicator';
        debugEl.textContent = 'Player Ready!';
        debugEl.style.cssText = 'position: absolute; top: 50px; left: 50%; transform: translateX(-50%); background: green; color: white; padding: 5px 10px; border-radius: 4px; z-index: 1000;';
        videoContainer.value.appendChild(debugEl);

        // Remove indicator after 5 seconds
        setTimeout(() => {
          if (videoContainer.value?.contains(debugEl)) {
            videoContainer.value.removeChild(debugEl);
          }
        }, 5000);
      }

      emit('ready', playerMethods);

      // Set initial time if provided
      if (props.startTime > 0) {
        console.log(`[VideoJSPlayer] Setting initial time to ${props.startTime}`);
        player.value?.currentTime(props.startTime);
      }

      // Load subtitles
      loadSubtitles();

      // Setup subtitle observer for Yomichan compatibility
      setupSubtitleObserver();
    });

    // Add error handler
    player.value.on('error', () => {
      const playerError = player.value?.error();
      console.error('[VideoJSPlayer] Player error:', playerError && playerError.message);
      emit('error', new Error(playerError ? playerError.message : 'Unknown player error'));
    });

  } catch (error: unknown) {
    console.error('[VideoJSPlayer] Error initializing player:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    emit('error', new Error(errorMessage));
  }
});

// Clean up on component unmount
onBeforeUnmount(() => {
  if (player.value) {
    // Remove event listeners
    player.value.textTracks().removeEventListener('change', handleTextTrackChange);
    if (player.value.audioTracks) {
      player.value.audioTracks().removeEventListener('change', handleAudioTrackChange);
    }

    // Disconnect observer
    if (subtitleObserver.value) {
      subtitleObserver.value.disconnect();
    }

    // Dispose player
    player.value.dispose();
  }
});

// Watch for changes in subtitles
watch(() => props.subtitles, () => {
  if (player.value) {
    loadSubtitles();
  }
}, { deep: true });

// Watch for source changes
watch(() => props.src, (newSrc) => {
  if (player.value && newSrc) {
    // Validate the source URL before setting it
    if (newSrc && (newSrc.startsWith('http') || newSrc.startsWith('blob:') || newSrc.startsWith('file:'))) {
      player.value.src({ src: newSrc });
      player.value.load();
    } else {
      console.error('Invalid video source URL:', newSrc);
      emit('error', new Error('Invalid video source URL'));
    }
  }
});

// Handle text track change
function handleTextTrackChange() {
  if (!player.value) return;

  const tracks = player.value.textTracks();
  let activeTrack = -1;

  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].mode === 'showing') {
      activeTrack = i;
      break;
    }
  }

  emit('subtitle-change', activeTrack);
}

// Handle audio track change
function handleAudioTrackChange() {
  if (!player.value || !player.value.audioTracks) return;

  const tracks = player.value.audioTracks();
  let activeTrack = -1;

  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].enabled) {
      activeTrack = i;
      break;
    }
  }

  emit('audio-track-change', activeTrack);
}

// Load subtitles
function loadSubtitles() {
  if (!player.value) return;

  // Remove existing text tracks
  for (let i = player.value.textTracks().length - 1; i >= 0; i--) {
    player.value.removeRemoteTextTrack(player.value.textTracks()[i]);
  }

  // Add new subtitle tracks using native text tracks
  props.subtitles.forEach((subtitle, index) => {
    // Add all subtitles as standard WebVTT or SRT subtitles
    addStandardSubtitle(subtitle, index);
  });

  // Setup word click handler again after loading subtitles
  nextTick(() => {
    setupWordClickHandler();
  });
}

// Helper function to add standard subtitles
function addStandardSubtitle(subtitle: any, index: number) {
  if (player.value) {
    // Convert subtitle format from ASS to VTT if needed
    let src = subtitle.src;
    let label = subtitle.label || subtitle.language;

    // Mark ASS subtitles in the label for user information
    if (subtitle.format === 'ass') {
      label = `${label} (ASS - limited styling)`;
    }

    player.value.addRemoteTextTrack({
      kind: 'subtitles',
      src: src,
      srclang: subtitle.language,
      label: label,
      default: index === 0
    }, false);
  }
}

// Setup word click handler for Yomichan compatibility
function setupWordClickHandler() {
  if (!videoContainer.value) return;

  // Add click event listener to subtitle container
  const subtitleContainer = videoContainer.value.querySelector('.vjs-text-track-display');
  if (subtitleContainer) {
    subtitleContainer.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'SPAN' || target.tagName === 'DIV') {
        const word = target.textContent?.trim() || '';
        if (word) {
          emit('word-click', word);
        }
      }
    });
  }
}

// Setup MutationObserver to watch for subtitle changes
function setupSubtitleObserver() {
  if (!videoContainer.value) return;

  // Find or wait for the subtitle container
  const checkForSubtitleContainer = () => {
    if (!videoContainer.value) return;

    const subtitleContainer = videoContainer.value.querySelector<HTMLElement>('.vjs-text-track-display');

    if (subtitleContainer) {
      // Create observer to watch for changes to subtitles
      subtitleObserver.value = new MutationObserver((mutations) => {
        // Make sure all text is selectable for Yomichan
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                makeNodeSelectable(node as HTMLElement);
              }
            });
          }
        });
      });

      // Start observing
      subtitleObserver.value.observe(subtitleContainer, {
        childList: true,
        subtree: true
      });

      // Make existing nodes selectable
      makeNodeSelectable(subtitleContainer);
    } else {
      // Try again in a moment
      setTimeout(checkForSubtitleContainer, 500);
    }
  };

  checkForSubtitleContainer();
}

// Make all text nodes in an element selectable for Yomichan
function makeNodeSelectable(element: HTMLElement) {
  // Add necessary styles
  element.style.userSelect = 'text';
  element.style.cursor = 'text';

  // Process child elements
  Array.from(element.children).forEach(child => {
    makeNodeSelectable(child as HTMLElement);
  });
}

// Expose player methods to parent
defineExpose(playerMethods);
</script>

<style>
.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 300px; /* Ensure minimum height */
  transition: width 0.3s ease, margin-right 0.3s ease;
  background-color: #000; /* Add background color */
  display: flex; /* Use flexbox for better child element sizing */
  flex-direction: column;
  justify-content: center;
}

.video-container.sidebar-active {
  width: calc(100% - 350px);
  margin-right: 350px;
}

/* Make the video element take full container size */
.video-container .video-js {
  width: 100% !important;
  height: 100% !important;
  min-height: 300px; /* Ensure minimum height */
}

/* Sidebar toggle button */
.vjs-sidebar-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  background: rgba(43, 51, 63, 0.7);
  border: none;
  border-radius: 4px;
  color: white;
  z-index: 100;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.vjs-sidebar-toggle:hover {
  background: rgba(43, 51, 63, 0.9);
}

/* Make subtitles scannable by Yomichan */
.vjs-text-track-display span,
.vjs-text-track-display div {
  cursor: text !important;
  user-select: text !important;
  pointer-events: auto !important;
}

.vjs-text-track-display span:hover {
  text-decoration: underline;
  opacity: 0.9;
}

/* Ensure subtitles are visible and properly positioned */
.vjs-text-track-display {
  pointer-events: none;
  position: absolute;
  bottom: 10%;
  left: 0;
  right: 0;
  top: auto !important;
  transform: none !important;
}

/* Custom subtitle styling */
.vjs-text-track-cue {
  background-color: rgba(0, 0, 0, 0.7) !important;
  padding: 0.25em 0.5em !important;
  border-radius: 4px !important;
  max-width: 90% !important;
  margin: 0 auto !important;
  font-size: 20px !important;
  line-height: 1.4 !important;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8) !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .video-container.sidebar-active {
    width: 100%;
    margin-right: 0;
  }
}

/* Debug overlay */
.debug-overlay {
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 5px 10px;
  font-size: 12px;
  z-index: 2000;
  pointer-events: none;
}

/* Error message */
.player-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(255, 0, 0, 0.7);
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  text-align: center;
  max-width: 80%;
}
</style>