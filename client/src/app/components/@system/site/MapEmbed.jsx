// @system — Map embed with no API key by default.
//   provider 'osm'    → OpenStreetMap iframe built from lat/lng/zoom
//   provider 'google' → Google Maps iframe from map.embedUrl (paste the "Embed a map" URL)
//   provider 'none'   → address card only
// brand.json securityHeaders.contentSecurityPolicy.frameSrc must allow the
// provider origin (the template ships with openstreetmap.org + google.com).
import { MapPin, ExternalLink } from 'lucide-react'
import { site } from '@/config'
import { cn } from '@/app/lib/@system/utils'

/** Bounding box roughly matching a slippy-map zoom level at the given centre. */
export function osmBbox(lat, lng, zoom = 15) {
  const z = Math.max(1, Math.min(19, Number(zoom) || 15))
  const spanLng = 360 / Math.pow(2, z) * 1.5
  const spanLat = spanLng * 0.6
  const r = (n) => Number(n.toFixed(5))
  return [r(lng - spanLng / 2), r(lat - spanLat / 2), r(lng + spanLng / 2), r(lat + spanLat / 2)]
}

export function osmEmbedUrl({ lat, lng, zoom }) {
  const [w, s, e, n] = osmBbox(lat, lng, zoom)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${w}%2C${s}%2C${e}%2C${n}&layer=mapnik&marker=${lat}%2C${lng}`
}

export function osmLinkUrl({ lat, lng, zoom = 15 }) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`
}

export function MapEmbed({ className, title = 'Map' }) {
  const map = site.map ?? {}
  const provider = map.provider ?? 'osm'
  const hasCoords = Number.isFinite(Number(map.lat)) && Number.isFinite(Number(map.lng))
  const address = map.address || (site.contact?.address?.lines ?? []).join(', ')

  let src = ''
  let link = ''
  if (provider === 'google' && map.embedUrl) {
    src = map.embedUrl
    link = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : ''
  } else if (provider === 'osm' && hasCoords) {
    const coords = { lat: Number(map.lat), lng: Number(map.lng), zoom: map.zoom ?? 15 }
    src = osmEmbedUrl(coords)
    link = osmLinkUrl(coords)
  }

  if (!src) {
    return (
      <div
        data-testid="map-fallback"
        className={cn('flex h-full min-h-[220px] flex-col items-start justify-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-6', className)}
      >
        <MapPin className="h-6 w-6 text-brand-primary" aria-hidden="true" />
        <address className="not-italic text-base leading-relaxed text-brand-text">{address || 'Address to be announced'}</address>
        {address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
          >
            Open in maps <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    )
  }

  return (
    <figure data-testid="map-embed" className={cn('overflow-hidden rounded-xl border border-brand-border bg-brand-surface', className)}>
      <iframe
        title={title}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="block h-[280px] w-full border-0 sm:h-[340px] lg:h-full lg:min-h-[360px]"
      />
      {(address || link) && (
        <figcaption className="flex flex-col gap-1 border-t border-brand-border p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          {address && <address className="not-italic text-brand-text-secondary">{address}</address>}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline">
              Open larger map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </figcaption>
      )}
    </figure>
  )
}

export default MapEmbed
