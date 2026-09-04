// src/pages/ProjectMap.jsx
// Interactive map showing all KSR project locations using Leaflet + OpenStreetMap
// No API key required

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')

// Status colours matching the rest of the app
const STATUS_COLORS = {
  available:   '#9ACD7A',
  blocked:     '#E8A838',
  booked:      '#4A7EB5',
  registered:  '#1B2A4A',
}

export default function ProjectMap() {
  const navigate = useNavigate()
  const mapRef    = useRef(null)
  const mapObj    = useRef(null)
  const layerRef  = useRef(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects-map'],
    queryFn: async () => {
      // Fetch projects
      const { data: projs, error: pErr } = await supabase
        .schema('ksr')
        .from('projects')
        .select('id, name, latitude, longitude, is_jv')
        .order('name')
      if (pErr) throw pErr

      // Fetch plot status counts per project
      const { data: plots, error: plErr } = await supabase
        .schema('ksr')
        .from('plots')
        .select('project_id, status')
        .eq('plot_type', 'plot')
      if (plErr) throw plErr

      // Merge
      return projs.map(p => ({
        ...p,
        plots: plots.filter(pl => pl.project_id === p.id)
      }))
    },
  })

  // Inject Leaflet CSS + JS dynamically (no npm install needed)
  useEffect(() => {
    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }
    // MarkerCluster CSS
    if (!document.getElementById('markercluster-css')) {
      const link = document.createElement('link')
      link.id   = 'markercluster-css'
      link.rel  = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css'
      document.head.appendChild(link)
    }

    const loadScript = (id, src, cb) => {
      if (document.getElementById(id)) { cb(); return }
      const s = document.createElement('script')
      s.id  = id
      s.src = src
      s.onload = cb
      document.head.appendChild(s)
    }

    // Load Leaflet, then MarkerCluster, then init map
    loadScript('leaflet-js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', () => {
      loadScript('markercluster-js',
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js',
        () => {
          if (!mapObj.current && mapRef.current) {
            const L = window.L
            // Default centre: Coimbatore area (adjust if projects are elsewhere)
            const map = L.map(mapRef.current, { zoomControl: true }).setView([11.0168, 76.9558], 11)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
              maxZoom: 19,
            }).addTo(map)
            mapObj.current = map
          }
        }
      )
    })

    return () => {
      if (mapObj.current) {
        mapObj.current.remove()
        mapObj.current = null
      }
    }
  }, [])

  // Add/update markers when projects load
  useEffect(() => {
    if (!mapObj.current || !projects.length) return

    const L = window.L
    if (!L) return

    // Remove previous layer
    if (layerRef.current) {
      mapObj.current.removeLayer(layerRef.current)
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    })

    const bounds = []
    const located = projects.filter(p => p.latitude && p.longitude)

    located.forEach(proj => {
      const plots  = Array.isArray(proj.plots) ? proj.plots : []
      const counts = { available: 0, blocked: 0, booked: 0, registered: 0 }
      plots.forEach(p => {
        if (p && p.status && counts[p.status] !== undefined) counts[p.status]++
      })
      const total = plots.length

      // Custom pin colour — navy for registered-heavy, green for available-heavy
      const pct_sold = total > 0 ? ((counts.booked + counts.registered) / total) : 0
      const pinColor = pct_sold > 0.7 ? '#1B2A4A' : pct_sold > 0.3 ? '#4A7EB5' : '#9ACD7A'

      // Custom icon
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            background:${pinColor};color:white;
            border:2px solid white;border-radius:50% 50% 50% 0;
            width:28px;height:28px;
            transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
          ">
            <span style="transform:rotate(45deg);font-size:11px;font-weight:700">
              ${counts.available}
            </span>
          </div>`,
        iconSize:   [28, 28],
        iconAnchor: [14, 28],
        popupAnchor:[0, -30],
      })

      const marker = L.marker([proj.latitude, proj.longitude], { icon })

      // Popup content
      const popup = `
        <div style="font-family:Segoe UI,sans-serif;min-width:200px;">
          <div style="font-weight:700;font-size:14px;color:#1B2A4A;margin-bottom:6px;">
            ${proj.name}
            ${proj.is_jv ? '<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:4px;margin-left:4px;">JV</span>' : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px;">
            ${Object.entries(counts).map(([status, count]) => `
              <div style="display:flex;align-items:center;gap:5px;font-size:12px;color:#475569;">
                <span style="width:8px;height:8px;border-radius:2px;background:${STATUS_COLORS[status]};flex-shrink:0;"></span>
                ${status.charAt(0).toUpperCase()+status.slice(1)}: <strong>${count}</strong>
              </div>`).join('')}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">
            Total plots: ${total}
          </div>
          <button
            onclick="window.__ksrNavigate('${proj.id}')"
            style="width:100%;padding:6px 0;background:#1B2A4A;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
            View Project →
          </button>
        </div>`

      marker.bindPopup(popup, { maxWidth: 240 })
      cluster.addLayer(marker)
      bounds.push([proj.latitude, proj.longitude])
    })

    mapObj.current.addLayer(cluster)
    layerRef.current = cluster

    // Fit map to all project locations
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        mapObj.current.setView(bounds[0], 14)
      } else {
        mapObj.current.fitBounds(bounds, { padding: [40, 40] })
      }
    }

    // Bridge for popup button → React navigate
    window.__ksrNavigate = (projectId) => navigate(`/projects/${projectId}?returnTo=/project-map`)

    return () => { delete window.__ksrNavigate }
  }, [projects, navigate])

  const located   = projects.filter(p => p.latitude && p.longitude)
  const unlocated = projects.filter(p => !p.latitude || !p.longitude)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'Segoe UI,sans-serif'}}>
      {/* Header */}
      <div style={{
        padding:'12px 20px',background:'white',borderBottom:'1px solid #e2e8f0',
        display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,
      }}>
        <div>
          <div style={{fontSize:'18px',fontWeight:700,color:'#1B2A4A'}}>Project Map</div>
          <div style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>
            {located.length} of {projects.length} projects mapped
          </div>
        </div>
        {/* Legend */}
        <div style={{display:'flex',gap:'14px',fontSize:'12px',alignItems:'center'}}>
          <span style={{color:'#64748b'}}>Pin shows available count · Colour = sales progress</span>
          <div style={{display:'flex',gap:'8px'}}>
            {[['Mostly available','#9ACD7A'],['Selling','#4A7EB5'],['Mostly sold','#1B2A4A']].map(([l,c])=>(
              <span key={l} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                <span style={{width:'10px',height:'10px',borderRadius:'50%',background:c,display:'inline-block'}}/>
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{flex:1,position:'relative'}}>
        {isLoading && (
          <div style={{
            position:'absolute',inset:0,background:'rgba(255,255,255,0.8)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,
            fontSize:'14px',color:'#64748b'
          }}>
            Loading projects...
          </div>
        )}
        <div ref={mapRef} style={{width:'100%',height:'100%'}} />

        {/* Unlocated projects warning */}
        {unlocated.length > 0 && (
          <div style={{
            position:'absolute',bottom:'20px',left:'50%',transform:'translateX(-50%)',
            background:'white',borderRadius:'8px',padding:'10px 16px',
            boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:500,
            fontSize:'12px',color:'#92400e',
            border:'1px solid #fde68a',
          }}>
            ⚠ {unlocated.length} project{unlocated.length>1?'s':''} not on map —
            add coordinates in Project settings:{' '}
            <strong>{unlocated.map(p => p.name).join(', ')}</strong>
          </div>
        )}
      </div>
    </div>
  )
}
