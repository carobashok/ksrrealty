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
  const first = plots?.find(p => p.polygon_coords && p.bg_width)
  const W = first?.bg_width || 800
  const H = first?.bg_height || 400

  return (
    <div style={{padding:'20px',fontFamily:'Segoe UI,sans-serif'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
        <Link to="/projects" style={{color:'#94a3b8'}}><ArrowLeft size={16}/></Link>
        <h1 style={{fontSize:'18px',fontWeight:700,color:'#1B2A4A'}}>
          {project?.name} — Inventory
        </h1>
      </div>

      <div style={{display:'flex',gap:'14px',marginBottom:'12px',fontSize:'12px'}}>
        {Object.entries(SL).map(([s,l]) => (
          <span key={s} style={{display:'flex',alignItems:'center',gap:'5px'}}>
            <span style={{width:'11px',height:'11px',borderRadius:'2px',background:SC[s],display:'inline-block'}}/>
            {l}
          </span>
        ))}
      </div>

      <div style={{display:'flex',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
        {[['Available',counts.available],['Blocked',counts.blocked],['Booked',counts.booked],['Registered',counts.registered],['Total',plots?.length||0]].map(([l,v])=>(
          <div key={l} style={{background:'white',borderRadius:'7px',padding:'8px 14px',textAlign:'center',border:'1px solid #e2e8f0',minWidth:'80px'}}>
            <div style={{fontSize:'20px',fontWeight:700,color:'#1B2A4A'}}>{v}</div>
            <div style={{fontSize:'10px',color:'#64748b'}}>{l}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p style={{color:'#94a3b8',padding:'40px',textAlign:'center'}}>Loading...</p>
      ) : !first ? (
        <p style={{color:'#94a3b8',padding:'40px',textAlign:'center'}}>No geometry. Plots: {plots?.length}</p>
      ) : (
        <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'8px',overflow:'auto'}}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg">
            {plots.map(p => {
              const coords = p.polygon_coords
              if (!Array.isArray(coords) || !coords.length) return null
              const pts = coords.map(c => `${c[0]},${c[1]}`).join(' ')
              const cx = coords.reduce((s,c)=>s+c[0],0)/coords.length
              const cy = coords.reduce((s,c)=>s+c[1],0)/coords.length
              const fill = SC[p.status] || SC.available
              const isSelected = sel?.id === p.id
              return (
                <g key={p.id} onClick={() => setSel(isSelected ? null : p)} style={{cursor:'pointer'}}>
                  <polygon points={pts} fill={fill} stroke={isSelected?'#F59E0B':'#1B2A4A'} strokeWidth={isSelected?2.5:1}/>
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                    fontSize="14" fontWeight="600" fill="#1B2A4A" pointerEvents="none">
                    {p.plot_number}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}

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