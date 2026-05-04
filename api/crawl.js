import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { source_id } = req.body || {}
  if (!source_id) return res.status(400).json({ error: 'source_id required' })

  const { data: source, error: srcErr } = await supabase
    .from('inspo_sources')
    .select('*')
    .eq('id', source_id)
    .single()

  if (srcErr || !source) return res.status(404).json({ error: 'Source not found' })

  const rawUrl = source.url
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

  try {
    const resp = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`)

    const text = await resp.text()
    const isXml = text.trimStart().startsWith('<?xml') || /<(?:rss|feed|rdf)[^>]*>/.test(text)

    const candidates = isXml ? parseRSS(text) : scrapeHTML(text, url)

    // Deduplicate against what's already stored for this source
    const { data: existing } = await supabase
      .from('inspo_photos')
      .select('image_url')
      .eq('source_id', source_id)

    const seen = new Set((existing || []).map(p => p.image_url))
    const fresh = candidates.filter(c => c.image_url && !seen.has(c.image_url))

    let added = 0
    if (fresh.length > 0) {
      const rows = fresh.map((c, i) => ({
        source_id,
        image_url: c.image_url,
        thumb_url: c.image_url,
        page_url: c.page_url || null,
        alt_text: c.alt_text || null,
        position: (existing?.length || 0) + i,
        tags: [],
        favorited: false,
        hidden: false,
      }))
      const { error: insertErr } = await supabase.from('inspo_photos').insert(rows)
      if (insertErr) throw insertErr
      added = fresh.length
    }

    await supabase
      .from('inspo_sources')
      .update({ last_crawled_at: new Date().toISOString() })
      .eq('id', source_id)

    return res.status(200).json({ added, found: candidates.length })
  } catch (err) {
    console.error('[crawl] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── RSS / Atom parser ──────────────────────────────────────

function parseRSS(xml) {
  const photos = []

  const items = [...xml.matchAll(/<(?:item|entry)([\s\S]*?)<\/(?:item|entry)>/gi)]

  for (const match of items) {
    const body = match[1] || match[0]

    // Page URL
    const pageUrl =
      cdata(body.match(/<link>([\s\S]*?)<\/link>/i)?.[1]) ||
      body.match(/<link[^>]+href="([^"]+)"/i)?.[1] ||
      null

    // Alt text from title
    const altText = cdata(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1])

    // Image — try in priority order
    let imageUrl =
      // media:content with explicit image medium/type
      body.match(/<media:content[^>]+medium="image"[^>]+url="([^"]+)"/i)?.[1] ||
      body.match(/<media:content[^>]+url="([^"]+)"[^>]+medium="image"/i)?.[1] ||
      body.match(/<media:content[^>]+type="image[^"]*"[^>]+url="([^"]+)"/i)?.[1] ||
      body.match(/<media:content[^>]+url="([^"]+)"[^>]+type="image/i)?.[1] ||
      // media:content without type (common in Vogue/Condé Nast feeds)
      body.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ||
      // media:thumbnail
      body.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ||
      // enclosure
      body.match(/<enclosure[^>]+type="image[^"]*"[^>]+url="([^"]+)"/i)?.[1] ||
      body.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i)?.[1] ||
      null

    // Fall back: first <img> in description or content:encoded
    if (!imageUrl) {
      const descRaw =
        cdata(body.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1]) ||
        cdata(body.match(/<description>([\s\S]*?)<\/description>/i)?.[1]) || ''
      imageUrl = descRaw.match(/<img[^>]+src="([^"\"]+)"/i)?.[1] || null
    }

    if (imageUrl && isPhoto(imageUrl)) {
      photos.push({ image_url: imageUrl, page_url: pageUrl, alt_text: stripTags(altText) })
    }
  }

  return photos
}

// ── HTML scraper ───────────────────────────────────────────

function scrapeHTML(html, baseUrl) {
  const photos = []
  let origin
  try { origin = new URL(baseUrl).origin } catch { origin = '' }

  const imgTags = [...html.matchAll(/<img([^>]+)>/gi)]

  for (const [, attrs] of imgTags) {
    // Prefer data-src (lazy loaded), then src, then first srcset entry
    const src =
      attrs.match(/\bdata-src="([^"]+)"/i)?.[1] ||
      attrs.match(/\bsrc="([^"]+)"/i)?.[1] ||
      attrs.match(/\bsrcset="([^"]+)"/i)?.[1]?.split(',')[0]?.trim()?.split(/\s+/)[0]

    if (!src) continue

    let full
    try {
      full = src.startsWith('http') ? src
        : src.startsWith('//') ? `https:${src}`
        : `${origin}${src.startsWith('/') ? '' : '/'}${src}`
    } catch { continue }

    const alt = attrs.match(/\balt="([^"]*)"/i)?.[1] || null

    if (isPhoto(full) && !isChrome(full)) {
      photos.push({ image_url: full, page_url: baseUrl, alt_text: alt })
    }
  }

  // Deduplicate
  const seen = new Set()
  return photos
    .filter(p => { if (seen.has(p.image_url)) return false; seen.add(p.image_url); return true })
    .slice(0, 60)
}

// ── Helpers ────────────────────────────────────────────────

function cdata(str) {
  if (!str) return null
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || null
}

function stripTags(str) {
  if (!str) return null
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() || null
}

function isPhoto(url) {
  if (!url || url.startsWith('data:')) return false
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$|#)/i.test(url)) return true
  // CDN / image service patterns common in fashion media
  if (/\/(image|photo|img|media|photos|picture|editorial)\//i.test(url)) return true
  if (/(?:cdn\d*|assets|static|media)\./i.test(url) && !/\.(js|css|woff|svg)/.test(url)) return true
  if (/(?:cloudinary|imgix|twimg\.com|images\.squarespace|condé|cdn\.vox|cdn\.ssense)/i.test(url)) return true
  return false
}

function isChrome(url) {
  if (/\/(logo|icon|avatar|sprite|favicon|pixel|badge|button|placeholder|blank|spacer)/i.test(url)) return true
  if (/[?&](?:w|width)=(\d+)/.test(url) && parseInt(url.match(/[?&](?:w|width)=(\d+)/)?.[1]) < 300) return true
  if (/1[x×]1|pixel\.gif|tracking/i.test(url)) return true
  return false
}
