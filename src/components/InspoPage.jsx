import { useState, useRef, useEffect } from 'react'
import { useInspo } from '../hooks/useInspo'

const FAVORITES_ID = '__favorites__'

const ALL_TAGS = [
  'warm', 'cool', 'neutral', 'moody', 'monochrome',
  'edgy', 'avant-garde', 'streetwear', 'editorial', 'minimal', 'candid',
  'golden hour', 'natural', 'indoor', 'night', 'studio',
]

// ── Masonry grid ───────────────────────────────────────────
function InspoMasonry({ photos, folders, sources, onFavorite, onHide, onSaveToFolder, onShootFilter }) {
  const [lightbox, setLightbox] = useState(null)

  if (!photos.length) {
    return (
      <div className="inspo-empty">
        <div className="inspo-empty-icon">✦</div>
        <div className="inspo-empty-label">No photos yet</div>
        <div className="inspo-empty-sub">Add a source and click Crawl now to start pulling fashion inspo</div>
      </div>
    )
  }

  return (
    <>
      <div className="inspo-masonry">
        {photos.map(photo => (
          <InspoCard
            key={photo.id}
            photo={photo}
            folders={folders}
            sources={sources}
            onFavorite={onFavorite}
            onHide={onHide}
            onSaveToFolder={onSaveToFolder}
            onShootFilter={onShootFilter}
            onClick={() => setLightbox(photo)}
          />
        ))}
      </div>
      {lightbox && (
        <div className="inspo-lightbox" onClick={() => setLightbox(null)}>
          <button className="inspo-lb-close" onClick={() => setLightbox(null)}>✕</button>
          <img
            src={lightbox.image_url}
            alt={lightbox.alt_text || ''}
            className="inspo-lb-img"
            onClick={e => e.stopPropagation()}
          />
          {lightbox.photographer && (
            <div className="inspo-lb-credit" onClick={e => e.stopPropagation()}>
              © {lightbox.photographer}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function InspoCard({ photo, folders, sources, onFavorite, onHide, onSaveToFolder, onShootFilter, onClick }) {
  const [hovering, setHovering] = useState(false)
  const [folderDropOpen, setFolderDropOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!folderDropOpen) return
    function onClickOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setFolderDropOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [folderDropOpen])

  const sourceName = sources.find(s => s.id === photo.source_id)?.name || null

  return (
    <div
      className="inspo-card"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setFolderDropOpen(false) }}
    >
      <img
        src={photo.thumb_url || photo.image_url}
        alt={photo.alt_text || ''}
        className="inspo-card-img"
        loading="lazy"
        onClick={onClick}
      />
      {hovering && (
        <div className="inspo-card-overlay">
          <div className="inspo-card-top-right">
            <button
              className="inspo-card-hide"
              onClick={e => { e.stopPropagation(); onHide(photo.id) }}
              title="Hide"
            >
              ✕
            </button>
          </div>
          <div className="inspo-card-bottom">
            <div className="inspo-card-source">
              {sourceName && <span className="inspo-card-source-name">{sourceName}</span>}
              {photo.page_url && (
                <a
                  className="inspo-card-story-link"
                  href={photo.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                >
                  View story ↗
                </a>
              )}
              {photo.page_url && (
                <button
                  className="inspo-card-shoot-btn"
                  onClick={e => { e.stopPropagation(); onShootFilter(photo.page_url) }}
                  title="See all photos from this story"
                >
                  More from shoot
                </button>
              )}
            </div>
            <div className="inspo-card-actions">
              <button
                className={`inspo-card-fav${photo.favorited ? ' active' : ''}`}
                onClick={e => { e.stopPropagation(); onFavorite(photo.id) }}
                title={photo.favorited ? 'Unfavorite' : 'Favorite'}
              >
                {photo.favorited ? '♥' : '♡'}
              </button>
              <div className="inspo-card-folder-wrap" ref={dropRef}>
                <button
                  className={`inspo-card-save${photo.folder_id ? ' assigned' : ''}`}
                  onClick={e => { e.stopPropagation(); setFolderDropOpen(o => !o) }}
                  title="Save to folder"
                >
                  ＋
                </button>
                {folderDropOpen && (
                  <div className="inspo-folder-drop" onClick={e => e.stopPropagation()}>
                    {folders.map(f => (
                      <button
                        key={f.id}
                        className={`inspo-folder-drop-item${photo.folder_id === f.id ? ' active' : ''}`}
                        onClick={() => { onSaveToFolder(photo.id, f.id); setFolderDropOpen(false) }}
                      >
                        {photo.folder_id === f.id && <span className="inspo-folder-drop-check">✓</span>}
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {photo.favorited && <div className="inspo-card-fav-dot" />}
    </div>
  )
}

// ── Tag editor modal ───────────────────────────────────────
function TagEditorModal({ photo, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set(photo.tags || []))

  function toggle(tag) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  return (
    <div className="inspo-modal-overlay" onClick={onClose}>
      <div className="inspo-modal" onClick={e => e.stopPropagation()}>
        <div className="inspo-modal-header">
          <span className="inspo-modal-title">Edit Tags</span>
          <button className="inspo-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="inspo-tag-grid">
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              className={`inspo-tag-pill${selected.has(tag) ? ' selected' : ''}`}
              onClick={() => toggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="inspo-modal-footer">
          <button className="inspo-modal-save" onClick={() => onSave(photo.id, [...selected])}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add source modal ───────────────────────────────────────
function AddSourceModal({ onSave, onClose }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!url.trim()) return
    setSaving(true)
    setErr(null)
    const { error } = await onSave(null, url, label)
    setSaving(false)
    if (error) {
      setErr(error.message || JSON.stringify(error))
    } else {
      onClose()
    }
  }

  return (
    <div className="inspo-modal-overlay" onClick={onClose}>
      <div className="inspo-modal" onClick={e => e.stopPropagation()}>
        <div className="inspo-modal-header">
          <span className="inspo-modal-title">Add Source</span>
          <button className="inspo-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="inspo-source-form">
          <label className="inspo-form-label">URL</label>
          <input
            autoFocus
            className="inspo-form-input"
            placeholder="https://..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <label className="inspo-form-label">Label (optional)</label>
          <input
            className="inspo-form-input"
            placeholder="e.g. W Magazine"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          {err && <div className="inspo-form-error">{err}</div>}
          <button type="submit" className="inspo-form-submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add Source'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main InspoPage component ───────────────────────────────
export default function InspoPage() {
  const {
    folders, sources, photos, loading,
    addFolder, renameFolder, deleteFolder,
    addSource, deleteSource,
    toggleFavorite, hidePhoto, updatePhotoTags, updatePhotoFolder, clearAllPhotos,
    triggerCrawl,
  } = useInspo()

  const [activeFolderId, setActiveFolderId] = useState(null)
  const [filterTags, setFilterTags] = useState([])
  const [shootFilter, setShootFilter] = useState(null)

  const [tagEditPhoto, setTagEditPhoto] = useState(null)
  const [addSourceOpen, setAddSourceOpen] = useState(false)
  const [crawlingSourceId, setCrawlingSourceId] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')

  const dropRef = useRef(null)
  const [draggingOver, setDraggingOver] = useState(false)

  // ── Derived ───────────────────────────────────────────────
  const visiblePhotos = photos.filter(p => !p.hidden)

  const folderPhotos = (() => {
    if (activeFolderId === FAVORITES_ID) return visiblePhotos.filter(p => p.favorited)
    if (activeFolderId) return visiblePhotos.filter(p => p.folder_id === activeFolderId)
    return visiblePhotos
  })()

  const filtered = folderPhotos.filter(p => {
    if (filterTags.length > 0 && !filterTags.some(t => p.tags?.includes(t))) return false
    return true
  })

  const displayPhotos = shootFilter
    ? visiblePhotos.filter(p => p.page_url === shootFilter)
    : filtered

  const shootSourceName = shootFilter
    ? (() => {
        const src = sources.find(s => shootFilter.startsWith(s.url.startsWith('http') ? s.url : `https://${s.url}`))
        if (src) return src.name || src.url
        try { return new URL(shootFilter).hostname } catch { return shootFilter }
      })()
    : null

  // ── Drag / drop ───────────────────────────────────────────
  function handleDragOver(e) { e.preventDefault(); setDraggingOver(true) }
  function handleDragLeave() { setDraggingOver(false) }
  function handleDrop(e) { e.preventDefault(); setDraggingOver(false) }

  // ── Folder CRUD ───────────────────────────────────────────
  async function handleAddFolder(e) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    const { data } = await addFolder(newFolderName)
    if (data) setActiveFolderId(data.id)
    setNewFolderName('')
  }

  function startRename(folder) { setRenamingId(folder.id); setRenameVal(folder.name) }

  async function commitRename(id) {
    if (renameVal.trim()) await renameFolder(id, renameVal)
    setRenamingId(null)
  }

  // ── Crawl ─────────────────────────────────────────────────
  async function handleCrawl(sourceId) {
    setCrawlingSourceId(sourceId)
    await triggerCrawl(sourceId)
    setCrawlingSourceId(null)
  }

  async function handleClearAll() {
    await clearAllPhotos()
    setConfirmClear(false)
  }

  function toggleTagFilter(tag) {
    setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const activeTitle = activeFolderId === FAVORITES_ID
    ? '♥ Favorites'
    : activeFolderId
      ? (folders.find(f => f.id === activeFolderId)?.name || 'Folder')
      : 'All Photos'

  if (loading) {
    return <div className="inspo-loading">Loading inspiration board…</div>
  }

  return (
    <div className="inspo-page">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="inspo-sidebar">

        {/* App header */}
        <div className="inspo-sidebar-header">
          <span className="inspo-sidebar-logo">✦</span>
          <span className="inspo-sidebar-title">INSPO</span>
        </div>

        {/* Folders panel */}
        <div className="inspo-panel">
          <div className="inspo-panel-header">
            <span className="inspo-panel-label">Folders</span>
          </div>
          <div className="inspo-folder-list">
            <div
              className={`inspo-folder-row${activeFolderId === null ? ' active' : ''}`}
              onClick={() => setActiveFolderId(null)}
            >
              <span className="inspo-folder-name">All photos</span>
              <span className="inspo-folder-count">{visiblePhotos.length}</span>
            </div>
            <div
              className={`inspo-folder-row${activeFolderId === FAVORITES_ID ? ' active' : ''}`}
              onClick={() => setActiveFolderId(FAVORITES_ID)}
            >
              <span className="inspo-folder-name">♥ Favorites</span>
              <span className="inspo-folder-count">{visiblePhotos.filter(p => p.favorited).length}</span>
            </div>
            {folders.map(folder => (
              <div
                key={folder.id}
                className={`inspo-folder-row${activeFolderId === folder.id ? ' active' : ''}`}
                onClick={() => setActiveFolderId(folder.id)}
              >
                {renamingId === folder.id ? (
                  <input
                    className="inspo-folder-rename"
                    value={renameVal}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(folder.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(folder.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                ) : (
                  <>
                    <span className="inspo-folder-name">{folder.name}</span>
                    <span className="inspo-folder-count">
                      {visiblePhotos.filter(p => p.folder_id === folder.id).length}
                    </span>
                    <button
                      className="inspo-folder-rename-btn"
                      onClick={e => { e.stopPropagation(); startRename(folder) }}
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      className="inspo-folder-del-btn"
                      onClick={e => { e.stopPropagation(); deleteFolder(folder.id) }}
                      title="Delete folder"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <form className="inspo-add-folder" onSubmit={handleAddFolder}>
            <input
              className="inspo-add-folder-input"
              placeholder="New folder…"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
            />
            <button type="submit" className="inspo-add-folder-btn">+</button>
          </form>
        </div>

        {/* Sources panel */}
        <div className="inspo-panel">
          <div className="inspo-panel-header">
            <span className="inspo-panel-label">Sources</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="inspo-panel-add" onClick={() => setAddSourceOpen(true)}>+</button>
              {photos.length > 0 && (
                <button className="inspo-clear-btn" onClick={() => setConfirmClear(true)}>Clear all</button>
              )}
            </div>
          </div>
          <div className="inspo-source-list">
            {sources.length === 0 && (
              <div className="inspo-source-empty">No sources yet — click + to add one</div>
            )}
            {sources.map(src => (
              <div key={src.id} className="inspo-source-row">
                <div className="inspo-source-info">
                  <span className="inspo-source-label">
                    {src.name || (() => { try { return new URL(src.url).hostname } catch { return src.url } })()}
                  </span>
                  {src.last_crawled_at && (
                    <span className="inspo-source-crawled">
                      Crawled {new Date(src.last_crawled_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="inspo-source-actions">
                  <button
                    className={`inspo-source-crawl-btn${crawlingSourceId === src.id ? ' crawling' : ''}`}
                    disabled={crawlingSourceId === src.id}
                    onClick={() => handleCrawl(src.id)}
                  >
                    {crawlingSourceId === src.id ? 'Crawling…' : 'Crawl now'}
                  </button>
                  <button
                    className="inspo-source-del-btn"
                    onClick={() => deleteSource(src.id)}
                    title="Remove source"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters panel */}
        <div className="inspo-panel">
          <div className="inspo-panel-header">
            <span className="inspo-panel-label">Filters</span>
            {filterTags.length > 0 && (
              <button className="inspo-filter-clear" onClick={() => setFilterTags([])}>Clear</button>
            )}
          </div>
          <div className="inspo-tag-filter-list">
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                className={`inspo-tag-filter-pill${filterTags.includes(tag) ? ' active' : ''}`}
                onClick={() => toggleTagFilter(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="inspo-filter-count">
            {filtered.length} photo{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </aside>

      {/* ── Main grid area ──────────────────────────────── */}
      <main
        className={`inspo-main${draggingOver ? ' drag-over' : ''}`}
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="inspo-main-header">
          <span className="inspo-main-title">{shootFilter ? 'Shoot' : activeTitle}</span>
          <span className="inspo-main-count">{displayPhotos.length}</span>
        </div>
        {shootFilter && (
          <div className="inspo-shoot-banner">
            <span className="inspo-shoot-banner-text">
              Showing {displayPhotos.length} photo{displayPhotos.length !== 1 ? 's' : ''} from this shoot
              {shootSourceName ? ` — ${shootSourceName}` : ''}
            </span>
            <button className="inspo-shoot-banner-back" onClick={() => setShootFilter(null)}>
              ← Back to all photos
            </button>
          </div>
        )}
        <div className="inspo-grid-scroll">
          <InspoMasonry
            photos={displayPhotos}
            folders={folders}
            sources={sources}
            onFavorite={toggleFavorite}
            onHide={hidePhoto}
            onSaveToFolder={updatePhotoFolder}
            onShootFilter={setShootFilter}
          />
        </div>
      </main>

      {/* ── Modals ──────────────────────────────────────── */}
      {tagEditPhoto && (
        <TagEditorModal
          photo={tagEditPhoto}
          onSave={async (id, tags) => { await updatePhotoTags(id, tags); setTagEditPhoto(null) }}
          onClose={() => setTagEditPhoto(null)}
        />
      )}
      {addSourceOpen && (
        <AddSourceModal
          onSave={addSource}
          onClose={() => setAddSourceOpen(false)}
        />
      )}
      {confirmClear && (
        <div className="inspo-modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="inspo-modal" onClick={e => e.stopPropagation()}>
            <div className="inspo-modal-header">
              <span className="inspo-modal-title">Clear all photos?</span>
              <button className="inspo-modal-close" onClick={() => setConfirmClear(false)}>✕</button>
            </div>
            <p className="inspo-confirm-text">
              Delete all crawled photos? This cannot be undone.
            </p>
            <div className="inspo-modal-footer" style={{ gap: 8 }}>
              <button className="inspo-confirm-cancel" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="inspo-confirm-delete" onClick={handleClearAll}>Delete all</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
