import React from 'react'
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ArrowLeft } from 'lucide-react'
import BlockPlotModal from '../components/BlockPlotModal'
import ReleaseBlockModal from '../components/ReleaseBlockModal'

const SC = { available:'#9ACD7A', blocked:'#E8A838', booked:'#4A7EB5', registered:'#1B2A4A' }
const SL = { available:'Available', blocked:'Blocked', booked:'Booked', registered:'Registered' }

// Road definitions — computed from plot edges
const ROADS = [
  {
    key: 'main',
    label: "21' Wide Road",
    angle: 13.37,
    polygon: [[460.11,273.75],[1951.02,628.1],[1927.99,725.01],[437.08,370.66]],
    labelX: 1194.0,
    labelY: 499.4,
  },
  {
    key: 'side',
    label: 'Existing Road',
    angle: 13.37,
    polygon: [[61.14,32.65],[199.59,65.56],[149.05,278.23],[10.6,245.32]],
    labelX: 105.1,
    labelY: 155.4,
  },
]

export default function PlotInventory() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [sel, setSel] = useState(null)
  const [showBlock, setShowBlock] = useState(false)
  const [showRelease, setShowRelease] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
      if (error) throw error
      return data
    },
  })

  const { data: plots, isLoading } = useQuery({
    queryKey: ['plots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plots')
        .select('id,plot_number,area_sqft,status,plot_type,polygon_coords,bg_width,bg_height')
        .eq('project_id', projectId)
        .eq('plot_type', 'plot')
        .order('plot_number')
      if (error) throw error
      return data
    },
  })

  const counts = { available:0, blocked:0, booked:0, registered:0 }
  plots?.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++ })
  const hasGeometry = plots?.some(p => Array.isArray(p.polygon_coords) && p.polygon_coords.length)

  const getBounds = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    plots?.forEach(p => {
      if (!Array.isArray(p.polygon_coords)) return
      p.polygon_coords.forEach(([x, y]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      })
    })
    ROADS.forEach(r => {
      r.polygon.forEach(([x, y]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      })
    })
    if (!isFinite(minX)) return null
    const pad = 30
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad*2, h: (maxY - minY) + pad*2 }
  }

  return (
    <div style={{padding:'20px',fontFamily:'Segoe UI,sans-serif'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
        <Link to="/projects" style={{color:'#94a3b8'}}><ArrowLeft size={16}/></Link>
        <h1 style={{fontSize:'18px',fontWeight:700,color:'#1B2A4A'}}>
          {project?.name} — Inventory
        </h1>
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:'14px',marginBottom:'12px',fontSize:'12px',flexWrap:'wrap'}}>
        {Object.entries(SL).map(([s,l]) => (
          <span key={s} style={{display:'flex',alignItems:'center',gap:'5px'}}>
            <span style={{width:'11px',height:'11px',borderRadius:'2px',background:SC[s],display:'inline-block'}}/>
            {l}
          </span>
        ))}
        <span style={{display:'flex',alignItems:'center',gap:'5px'}}>
          <span style={{width:'11px',height:'11px',borderRadius:'2px',background:'#94a3b8',display:'inline-block'}}/>
          Road
        </span>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
        {[['Available',counts.available],['Blocked',counts.blocked],['Booked',counts.booked],['Registered',counts.registered],['Total',plots?.length||0]].map(([l,v])=>(
          <div key={l} style={{background:'white',borderRadius:'7px',padding:'8px 14px',textAlign:'center',border:'1px solid #e2e8f0',minWidth:'80px'}}>
            <div style={{fontSize:'20px',fontWeight:700,color:'#1B2A4A'}}>{v}</div>
            <div style={{fontSize:'10px',color:'#64748b'}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      {isLoading ? (
        <p style={{color:'#94a3b8',padding:'40px',textAlign:'center'}}>Loading...</p>
      ) : !hasGeometry ? (
        <p style={{color:'#94a3b8',padding:'40px',textAlign:'center'}}>No geometry data. Plots: {plots?.length}</p>
      ) : (() => {
        const bounds = getBounds()
        if (!bounds) return null
        const fontSize = Math.max(6, Math.min(18, bounds.w / 55))
        const roadFontSize = Math.max(5, fontSize * 0.85)

        return (
          <div style={{
            background:'#f1f5f9',
            border:'1px solid #e2e8f0',
            borderRadius:'10px',
            padding:'12px',
          }}>
            <svg
              viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
              width="100%"
              style={{display:'block', maxHeight:'68vh'}}
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Roads rendered first — plots sit on top */}
              {ROADS.map(road => {
                const pts = road.polygon.map(c => `${c[0]},${c[1]}`).join(' ')
                // Dashed centre line: midpoint between TL↔BL and TR↔BR
                const tl = road.polygon[0], tr = road.polygon[1]
                const br = road.polygon[2], bl = road.polygon[3]
                const ml = [(tl[0]+bl[0])/2, (tl[1]+bl[1])/2]
                const mr = [(tr[0]+br[0])/2, (tr[1]+br[1])/2]

                return (
                  <g key={road.key}>
                    {/* Road surface */}
                    <polygon
                      points={pts}
                      fill="#94a3b8"
                      stroke="#64748b"
                      strokeWidth={fontSize * 0.08}
                    />
                    {/* Dashed centre line */}
                    <line
                      x1={ml[0]} y1={ml[1]}
                      x2={mr[0]} y2={mr[1]}
                      stroke="white"
                      strokeWidth={fontSize * 0.18}
                      strokeDasharray={`${fontSize*2.5} ${fontSize*1.5}`}
                    />
                    {/* Road label */}
                    <text
                      x={road.labelX}
                      y={road.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={roadFontSize}
                      fontWeight="700"
                      fill="white"
                      transform={`rotate(${road.angle}, ${road.labelX}, ${road.labelY})`}
                      pointerEvents="none"
                    >
                      {road.label}
                    </text>
                  </g>
                )
              })}

              {/* Plots */}
              {plots.map(p => {
                const coords = p.polygon_coords
                if (!Array.isArray(coords) || !coords.length) return null
                const pts = coords.map(c => `${c[0]},${c[1]}`).join(' ')
                const cx = coords.reduce((s,c) => s+c[0], 0) / coords.length
                const cy = coords.reduce((s,c) => s+c[1], 0) / coords.length
                const fill = SC[p.status] || SC.available
                const isSelected = sel?.id === p.id
                const labelColor = (p.status === 'registered' || p.status === 'booked') ? '#fff' : '#1B2A4A'

                return (
                  <g key={p.id} onClick={() => setSel(isSelected ? null : p)} style={{cursor:'pointer'}}>
                    <polygon
                      points={pts}
                      fill={fill}
                      stroke={isSelected ? '#F59E0B' : '#fff'}
                      strokeWidth={isSelected ? fontSize * 0.5 : fontSize * 0.18}
                    />
                    <text
                      x={cx} y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fontSize}
                      fontWeight="700"
                      fill={labelColor}
                      transform={`rotate(${13.37}, ${cx}, ${cy})`}
                      pointerEvents="none"
                    >
                      {p.plot_number}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )
      })()}

      {/* Selected plot panel */}
      {sel && (
        <div style={{background:'#EAF1FA',border:'1px solid #b8cde8',borderRadius:'8px',padding:'14px',marginTop:'14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
            <strong style={{color:'#1B2A4A'}}>Plot {sel.plot_number}</strong>
            <button onClick={()=>setSel(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'18px'}}>×</button>
          </div>
          <span style={{display:'inline-block',padding:'2px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:600,color:'white',background:SC[sel.status],marginBottom:'8px'}}>
            {SL[sel.status]}
          </span>
          {sel.area_sqft && <div style={{fontSize:'13px',color:'#475569',marginBottom:'10px'}}>Area: {sel.area_sqft} sq.ft</div>}
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {sel.status === 'available' && (
              <>
                <button onClick={() => setShowBlock(true)}
                  style={{padding:'7px 16px',background:'#E8A838',color:'white',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                  Block this plot
                </button>
                <button onClick={() => navigate(`/bookings/new?plotId=${sel.id}&projectId=${projectId}`)}
                  style={{padding:'7px 16px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                  Book this plot →
                </button>
              </>
            )}
            {sel.status === 'blocked' && (
              <>
                <button onClick={() => setShowRelease(true)}
                  style={{padding:'7px 16px',background:'white',color:'#ef4444',border:'1px solid #ef4444',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                  Release block
                </button>
                <button onClick={() => navigate(`/bookings/new?plotId=${sel.id}&projectId=${projectId}`)}
                  style={{padding:'7px 16px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                  Convert to booking →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showBlock && sel && (
        <BlockPlotModal plot={sel} onClose={() => { setShowBlock(false); setSel(null) }} />
      )}
      {showRelease && sel && (
        <ReleaseBlockModal plot={sel} onClose={() => { setShowRelease(false); setSel(null) }} />
      )}
    </div>
  )
}
