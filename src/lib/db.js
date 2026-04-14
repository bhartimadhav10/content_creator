import { supabase } from './supabase.js'

// Voice samples
export async function listVoiceSamples(userId) {
  const { data, error } = await supabase.from('voice_samples').select('*').eq('user_id', userId).order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}
export async function replaceVoiceSamples(userId, samples) {
  await supabase.from('voice_samples').delete().eq('user_id', userId)
  const clean = samples.map(s => s.trim()).filter(Boolean)
  if (!clean.length) return
  const rows = clean.map((content, i) => ({ user_id: userId, label: `Sample ${i + 1}`, content }))
  const { error } = await supabase.from('voice_samples').insert(rows)
  if (error) throw error
}

// Competitors
export async function listCompetitors(userId, platform = null) {
  let q = supabase.from('competitors').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (platform) q = q.eq('platform', platform)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
export async function addCompetitor(userId, { platform, handle, url = null, notes = null }) {
  const { data, error } = await supabase.from('competitors').insert({ user_id: userId, platform, handle, url, notes }).select().single()
  if (error) throw error
  return data
}
export async function removeCompetitor(id) {
  const { error } = await supabase.from('competitors').delete().eq('id', id)
  if (error) throw error
}

// Research runs
export async function saveResearch(userId, { platform, query, results }) {
  const { data, error } = await supabase.from('research_runs').insert({ user_id: userId, platform, query, results }).select().single()
  if (error) throw error
  return data
}
export async function latestResearch(userId, platform) {
  const { data } = await supabase.from('research_runs').select('*').eq('user_id', userId).eq('platform', platform).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data
}

// Generations
export async function saveGeneration(userId, { topic, script, hooks, source_platform = null }) {
  const { data, error } = await supabase.from('generations').insert({ user_id: userId, topic, script, hooks, source_platform }).select().single()
  if (error) throw error
  return data
}
export async function listGenerations(userId, limit = 50) {
  const { data, error } = await supabase.from('generations').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data || []
}
