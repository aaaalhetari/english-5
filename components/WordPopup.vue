<script setup lang="ts">
import dictionaryData from '~/data/dictionary.json'

const props = defineProps<{
  word: string
  contextMeanings: Record<string, string>
  contextSentence: string
}>()
const emit = defineEmits(['close'])

const { registerClick } = useVocabDB()
const { askWordMeaning } = useClaude()
const { speak, downloading, downloadProgress, selectedVoice, voiceOptions } = useTTS()

const meaning = ref('')
const loading = ref(false)
const source = ref('')
const showVoicePicker = ref(false)

async function resolveMeaning() {
  registerClick(props.word)

  if (props.contextMeanings[props.word]) {
    meaning.value = props.contextMeanings[props.word]
    source.value = 'this conversation'
    return
  }
  const dict = dictionaryData as Record<string, string>
  if (dict[props.word]) {
    meaning.value = dict[props.word]
    source.value = 'local dictionary'
    return
  }
  loading.value = true
  meaning.value = await askWordMeaning(props.word, props.contextSentence)
  source.value = 'AI'
  loading.value = false
}

onMounted(resolveMeaning)
</script>

<template>
  <div class="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-bold text-lg">{{ word }}</h3>
        <div class="flex items-center gap-2">
          <button class="text-slate-400 text-sm" @click="speak(word)">
            {{ downloading ? `⏳ ${downloadProgress}%` : '🔊' }}
          </button>
          <button class="text-slate-300 text-xs" @click="showVoicePicker = !showVoicePicker">⚙</button>
        </div>
      </div>

      <div v-if="showVoicePicker" class="mb-3 bg-slate-50 rounded-lg p-2">
        <p class="text-xs text-slate-400 mb-1">Voice</p>
        <select v-model="selectedVoice" class="w-full text-sm border border-slate-200 rounded px-2 py-1">
          <option v-for="v in voiceOptions" :key="v.id" :value="v.id">{{ v.label }}</option>
        </select>
      </div>

      <p v-if="downloading" class="text-xs text-slate-400 mb-2">
        First use: downloading a studio-quality neural voice, one time only...
      </p>
      <p v-if="loading" class="text-sm text-slate-400">Loading...</p>
      <p v-else class="text-sm text-slate-700 leading-relaxed">{{ meaning }}</p>
      <p v-if="!loading" class="text-xs text-slate-400 mt-2">Source: {{ source }}</p>
      <button class="mt-4 w-full bg-slate-100 rounded-lg py-2 text-sm" @click="emit('close')">Close</button>
    </div>
  </div>
</template>
