const PREFIX = 'ca.'

export const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(PREFIX + key)
      return v ? JSON.parse(v) : fallback
    } catch { return fallback }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  },
  remove(key) { localStorage.removeItem(PREFIX + key) }
}

export const KEYS = {
  GROQ: 'key.groq',
  YOUTUBE: 'key.youtube',
  APIFY: 'key.apify',
  APIFY_TRANSCRIPT_ACTOR: 'key.apify.transcript_actor',
  WORKER_URL: 'key.worker',
  NICHE: 'pref.niche',
  CREATOR: 'pref.creator',
  VOICE_SAMPLES: 'voice.samples',
  LAST_RESEARCH: 'research.last',
  SELECTED_TOPIC: 'research.selected'
}
