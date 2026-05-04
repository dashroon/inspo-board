import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_FOLDERS = ['Editorial', 'Street', 'Campaign', 'Runway', 'Saved']

const DEFAULT_SOURCES = [
  { name: 'W Magazine',          url: 'wmagazine.com/feed/rss' },
  { name: 'Antidote Magazine',   url: 'antidote-magazine.com/feed' },
  { name: 'Dust Magazine',       url: 'dustmagazine.com/feed' },
  { name: 'Vogue',               url: 'vogue.com/feed/rss' },
  { name: "Harper's Bazaar",     url: 'harpersbazaar.com/feed/rss' },
  { name: 'SSENSE Editorial',    url: 'ssense.com/en-us/editorial/feed' },
  { name: 'Business of Fashion', url: 'businessoffashion.com/feed' },
  { name: 'System Magazine',     url: 'system-magazine.com' },
  { name: '032c',                url: '032c.com' },
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
    const { data, error } = await supabase.functions.invoke('crawl-inspo', { body: { source_id: sourceId } })
    console.log('[inspo] crawl result:', data, error ? { error } : null)
    // Reload photos after crawl
    if (!error) {
      const { data: fresh } = await supabase
        .from('inspo_photos')
        .select('*')
        .or('hidden.is.null,hidden.eq.false')
        .order('position')
      if (fresh) setPhotos(fresh)
    }
    return { data, error }
  }, [])

  return {
    folders, sources, photos, loading,
    addFolder, renameFolder, deleteFolder,
    addSource, deleteSource,
    addPhoto, toggleFavorite, hidePhoto, deletePhoto, updatePhotoTags, updatePhotoFolder, clearAllPhotos,
    triggerCrawl,
  }
}
