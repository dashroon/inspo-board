import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_FOLDERS = ['Editorial', 'Street', 'Campaign', 'Runway', 'Saved']

const DEFAULT_SOURCES = [
  { name: 'Dust Magazine',       url: 'https://dustmagazine.com/feed' },
  { name: 'Vogue',               url: 'https://www.vogue.com/feed/rss' },
  { name: 'Vogue Runway',        url: 'https://www.vogue.com/feed/runway/rss' },
  { name: 'Business of Fashion', url: 'https://www.businessoffashion.com/feed' },
  { name: 'System Magazine',     url: 'https://system-magazine.com' },
  { name: '032c',                url: 'https://032c.com/feed' },
  { name: 'W Magazine',          url: 'https://www.wmagazine.com/feed/rss' },
  { name: "Harper's Bazaar",     url: 'https://www.harpersbazaar.com/rss/all.xml' },
  { name: 'SSENSE Editorial',    url: 'https://www.ssense.com/en-us/editorial/feed' },
]

export function useInspo() {
  const [folders, setFolders] = useState([])
  const [sources, setSources] = useState([])
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [fRes, sRes, pRes] = await Promise.all([
          supabase.from('inspo_folders').select('*').order('position'),
          supabase.from('inspo_sources').select('*').order('position'),
          supabase.from('inspo_photos').select('*').or('hidden.is.null,hidden.eq.false').order('position'),
        ])

        // Seed default folders
        if (!fRes.error) {
          let loaded = fRes.data || []
          if (loaded.length === 0) {
            const toSeed = DEFAULT_FOLDERS.map((name, i) => ({ name, position: i }))
            const { data: seeded } = await supabase.from('inspo_folders').insert(toSeed).select()
            loaded = seeded || []
          }
          setFolders(loaded)
        }

        // Seed default sources
        if (!sRes.error) {
          let loaded = sRes.data || []
          if (loaded.length === 0) {
            const toSeed = DEFAULT_SOURCES.map((s, i) => ({ name: s.name, url: s.url, position: i }))
            const { data: seeded } = await supabase.from('inspo_sources').insert(toSeed).select()
            loaded = seeded || []
          }
          setSources(loaded)
        }

        if (!pRes.error) setPhotos(pRes.data || [])
        setLoading(false)
      } catch (err) {
        console.error('[inspo] load error:', err)
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Folders ───────────────────────────────────────────────
  const addFolder = useCallback(async (name) => {
    const pos = folders.length
    const { data, error } = await supabase
      .from('inspo_folders')
      .insert({ name: name.trim(), position: pos })
      .select()
      .single()
    if (!error && data) setFolders(prev => [...prev, data])
    return { data, error }
  }, [folders.length])

  const renameFolder = useCallback(async (id, name) => {
    const { error } = await supabase.from('inspo_folders').update({ name: name.trim() }).eq('id', id)
    if (!error) setFolders(prev => prev.map(f => f.id === id ? { ...f, name: name.trim() } : f))
  }, [])

  const deleteFolder = useCallback(async (id) => {
    const { error } = await supabase.from('inspo_folders').delete().eq('id', id)
    if (!error) setFolders(prev => prev.filter(f => f.id !== id))
  }, [])

  // ── Sources ───────────────────────────────────────────────
  const addSource = useCallback(async (_folderId, url, label) => {
    const pos = sources.length
    const payload = { url: url.trim(), name: label?.trim() || null, position: pos }
    const { data, error } = await supabase
      .from('inspo_sources')
      .insert(payload)
      .select()
      .single()
    if (!error && data) setSources(prev => [...prev, data])
    return { data, error }
  }, [sources])

  const deleteSource = useCallback(async (id) => {
    const { error } = await supabase.from('inspo_sources').delete().eq('id', id)
    if (!error) setSources(prev => prev.filter(s => s.id !== id))
  }, [])

  // ── Photos ────────────────────────────────────────────────
  const addPhoto = useCallback(async (folderId, sourceId, fields) => {
    const pos = photos.length
    const { data, error } = await supabase
      .from('inspo_photos')
      .insert({ source_id: sourceId || null, position: pos, ...fields })
      .select()
      .single()
    if (!error && data) setPhotos(prev => [...prev, data])
    return { data, error }
  }, [photos])

  const toggleFavorite = useCallback(async (id) => {
    const photo = photos.find(p => p.id === id)
    if (!photo) return
    const next = !photo.favorited
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, favorited: next } : p))
    await supabase.from('inspo_photos').update({ favorited: next }).eq('id', id)
  }, [photos])

  const hidePhoto = useCallback(async (id) => {
    setPhotos(prev => prev.filter(p => p.id !== id))
    await supabase.from('inspo_photos').update({ hidden: true }).eq('id', id)
  }, [])

  const deletePhoto = useCallback(async (id) => {
    const { error } = await supabase.from('inspo_photos').delete().eq('id', id)
    if (!error) setPhotos(prev => prev.filter(p => p.id !== id))
  }, [])

  const updatePhotoTags = useCallback(async (id, tags) => {
    await supabase.from('inspo_photos').update({ tags }).eq('id', id)
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, tags } : p))
  }, [])

  const updatePhotoFolder = useCallback(async (id, folderId) => {
    await supabase.from('inspo_photos').update({ folder_id: folderId }).eq('id', id)
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, folder_id: folderId } : p))
  }, [])

  const clearAllPhotos = useCallback(async () => {
    const { error } = await supabase.from('inspo_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (!error) setPhotos([])
    return { error }
  }, [])

  // ── Crawler trigger ───────────────────────────────────────
  const triggerCrawl = useCallback(async (sourceId) => {
    const resp = await fetch('/api/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId }),
    })
    const result = await resp.json()
    console.log('[inspo] crawl result:', result)
    // Reload photos so new images appear immediately
    const { data: fresh } = await supabase
      .from('inspo_photos')
      .select('*')
      .or('hidden.is.null,hidden.eq.false')
      .order('position')
    if (fresh) setPhotos(fresh)
    // Update last_crawled_at in local sources state
    setSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, last_crawled_at: new Date().toISOString() } : s
    ))
    return result
  }, [])

  return {
    folders, sources, photos, loading,
    addFolder, renameFolder, deleteFolder,
    addSource, deleteSource,
    addPhoto, toggleFavorite, hidePhoto, deletePhoto, updatePhotoTags, updatePhotoFolder, clearAllPhotos,
    triggerCrawl,
  }
}
