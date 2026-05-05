import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_FOLDERS = ['Editorial', 'Street', 'Campaign', 'Runway', 'Saved']


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
          supabase.from('inspo_sources').select('*').order('created_at', { ascending: true }),
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

        if (!sRes.error) setSources(sRes.data || [])

        if (!pRes.error) setPhotos(pRes.data || [])
        setLoading(false)
      } catch (err) {
        console.error('[inspo] load error:', err)
        setLoading(false)
      }
    }
    load()

    const channel = supabase
      .channel('inspo_sources_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inspo_sources' },
        (payload) => {
          setSources((cur) => {
            if (payload.eventType === 'INSERT') {
              if (cur.some((s) => s.id === payload.new.id)) return cur
              return [...cur, payload.new]
            }
            if (payload.eventType === 'UPDATE') {
              return cur.map((s) => (s.id === payload.new.id ? payload.new : s))
            }
            if (payload.eventType === 'DELETE') {
              return cur.filter((s) => s.id !== payload.old.id)
            }
            return cur
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
  const addSource = useCallback(async (_folderId, urlOrHandle, label) => {
    const wantsBackfill = window.confirm(
      'Backfill the last ~50 posts from this account now?\n\n' +
      'OK = yes, pull recent posts immediately.\n' +
      'Cancel = no, just start collecting from tomorrow\'s daily run.'
    )

    const { data, error } = await supabase.functions.invoke('add-source', {
      body: {
        input: urlOrHandle,
        name: label || undefined,
        backfill: wantsBackfill,
      },
    })

    if (error) throw error
    if (data?.error) throw new Error(data.error)

    if (data?.source) {
      setSources((prev) => [...prev, data.source])
    }
    return data?.source
  }, [])

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
    const { data, error } = await supabase.functions.invoke('crawl-source', {
      body: { source_id: sourceId, depth: 'daily' },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data
  }, [])

  return {
    folders, sources, photos, loading,
    addFolder, renameFolder, deleteFolder,
    addSource, deleteSource,
    addPhoto, toggleFavorite, hidePhoto, deletePhoto, updatePhotoTags, updatePhotoFolder, clearAllPhotos,
    triggerCrawl,
  }
}
