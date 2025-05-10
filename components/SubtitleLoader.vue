<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCaptionsStore } from '~/stores/captions'

const store = useCaptionsStore()
const isLoading = ref(false)
const error = ref('')
const success = ref('')

const hasSubtitles = computed(() => store.subtitleTracks.length > 0)

// Emit events for parent components
const emit = defineEmits(['subtitles-loaded', 'subtitles-cleared'])

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  
  isLoading.value = true
  error.value = ''
  success.value = ''
  
  try {
    const files = Array.from(input.files)
    let loadedCount = 0
    
    for (const file of files) {
      // Try to extract language and title from filename
      // Format: filename_language_title.ext or filename.language.ext
      const filenameParts = file.name.split('.')
      const extension = filenameParts.pop()?.toLowerCase()
      const nameParts = filenameParts.join('.').split('_')
      
      let language = 'unknown'
      let title = file.name
      
      if (nameParts.length >= 3) {
        // Assume format is filename_language_title
        language = nameParts[nameParts.length - 2]
        title = nameParts[nameParts.length - 1]
      } else if (filenameParts.length >= 2) {
        // Try format filename.language.ext
        language = filenameParts[filenameParts.length - 1]
        title = filenameParts[0]
      }
      
      // Map common language codes
      if (language === 'en') language = 'eng'
      else if (language === 'ja') language = 'jpn'
      else if (language === 'es') language = 'spa'
      else if (language === 'fr') language = 'fre'
      else if (language === 'de') language = 'ger'
      else if (language === 'it') language = 'ita'
      else if (language === 'ru') language = 'rus'
      else if (language === 'pt') language = 'por'
      else if (language === 'ar') language = 'ara'
      
      // Check if it's a subtitle file
      if (['srt', 'vtt', 'ass'].includes(extension || '')) {
        const content = await file.text()
        const trackIndex = await store.loadCaptions(content, language, title)
        
        if (trackIndex !== undefined && trackIndex !== null) {
          loadedCount++
          // Emit event to notify parent components that subtitles were loaded
          emit('subtitles-loaded', {
            trackIndex,
            language,
            title,
            format: extension
          })
        } else {
          error.value = `Failed to parse subtitle file: ${file.name}`
        }
      } else {
        error.value = `Unsupported file format: ${extension}`
      }
    }
    
    if (loadedCount > 0) {
      success.value = `Loaded ${loadedCount} subtitle track(s)`
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error loading subtitles'
    console.error('Error loading subtitles:', e)
  } finally {
    isLoading.value = false
    // Reset input
    input.value = ''
  }
}

// Handle drag and drop events
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  
  if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return
  
  // Create a new event with the dropped files
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  
  // Use the FileList from the drop event
  const dT = new DataTransfer()
  for (let i = 0; i < event.dataTransfer.files.length; i++) {
    dT.items.add(event.dataTransfer.files[i])
  }
  input.files = dT.files
  
  // Process the files
  await handleFileUpload({ target: input } as unknown as Event)
}

function clearSubtitles() {
  store.clearCaptions()
  success.value = 'Subtitles cleared'
  error.value = ''
  // Emit event to notify parent components that subtitles were cleared
  emit('subtitles-cleared')
}
</script>

<template>
  <div class="subtitle-loader">
    <div class="flex flex-col gap-2">
      <!-- Drag and drop area -->
      <div 
        class="drag-drop-area border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer"
        @dragover="handleDragOver"
        @drop="handleDrop"
        @click="$refs.fileInput.click()"
      >
        <div class="text-lg mb-2">Drag & Drop Subtitle Files Here</div>
        <div class="text-sm text-gray-500">Or click to browse</div>
        <input 
          ref="fileInput" 
          type="file" 
          accept=".srt,.vtt,.ass" 
          multiple 
          class="hidden" 
          @change="handleFileUpload"
        >
      </div>
      
      <!-- Status messages -->
      <div v-if="isLoading" class="text-blue-500">Loading subtitles...</div>
      <div v-if="error" class="text-red-500">{{ error }}</div>
      <div v-if="success" class="text-green-500">{{ success }}</div>
      
      <!-- Subtitle tracks list -->
      <div v-if="hasSubtitles" class="mt-4">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-lg font-semibold">Loaded Subtitle Tracks</h3>
          <button 
            @click="clearSubtitles" 
            class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Clear All
          </button>
        </div>
        
        <div class="subtitle-tracks">
          <div 
            v-for="(track, index) in store.subtitleTracks" 
            :key="track.id"
            class="subtitle-track p-2 bg-gray-100 rounded mb-2 flex justify-between items-center"
          >
            <div>
              <div class="font-medium">{{ track.metadata.title }}</div>
              <div class="text-sm text-gray-600">{{ track.metadata.language }} - {{ track.captions.length }} captions</div>
            </div>
            <div class="flex gap-2">
              <button 
                @click="store.setActiveTrack(index)" 
                class="px-2 py-1 text-xs rounded"
                :class="index === store.activeTrackIndex ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'"
              >
                {{ index === store.activeTrackIndex ? 'Active' : 'Set Active' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drag-drop-area {
  transition: all 0.2s ease;
}

.drag-drop-area:hover {
  border-color: #4299e1;
  background-color: rgba(66, 153, 225, 0.05);
}

.subtitle-tracks {
  max-height: 200px;
  overflow-y: auto;
}
</style>