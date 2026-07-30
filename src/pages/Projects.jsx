import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Building2, Map, ChevronRight, X, Trash2, Search } from 'lucide-react'

const CENTS_TO_SQFT = 435.6
const ACRES_TO_SQFT = 43560

const REGION_UNITS = {
  Chennai:'sqft', Chengalpattu:'sqft', Tiruvallur:'sqft', Vellore:'sqft',
  Coimbatore:'cents', Kodaikanal:'cents', Ooty:'cents',
  Tiruchy:'sqft', Madurai:'sqft', Salem:'sqft', Other:'sqft'
}
const REGIONS = Object.keys(REGION_UNITS)

/*const fmt = (n) => n ? '₹' + parseFloat(n).toLocaleString('en-IN') : '—'*/
const fmt = (n) => n ? '₹' + Math.round(parseFloat(n)).toLocaleString('en-IN') : '—'

// Must match ksr.projects_status_check constraint values
const STATUS_STYLES = {
  active:      { background:'#dcfce7', color:'#166534' },
  on_hold:     { background:'#fef3c7', color:'#92400e' },
  completed:   { background:'#dbeafe', color:'#1e40af' },
}
const STATUS_LABELS = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
}

const S = {
  page:    { padding:'24px', fontFamily:'Segoe UI,sans-serif' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' },
  h1:      { fontSize:'22px', fontWeight:700, color:'#1B2A4A' },
  sub:     { fontSize:'13px', color:'#64748b', marginTop:'2px' },
  btn:     { display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', background:'#1B2A4A', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer' },
  grid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'16px' },
  card:    { background:'white', borderRadius:'10px', padding:'20px', boxShadow:'0 1px 4px #0001', border:'1px solid #e2e8f0' },
  badge:   (c) => ({ display:'inline-block', padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600, ...(STATUS_STYLES[c] || STATUS_STYLES.active) }),
  jvBadge: { display:'inline-block', padding:'2px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:600, background:'#fef3c7', color:'#92400e' },
  stat:    { textAlign:'center', flex:1 },
  statN:   { fontSize:'20px', fontWeight:700, color:'#1B2A4A' },
  statL:   { fontSize:'10px', color:'#64748b', marginTop:'2px' },
  actions: { display:'flex', gap:'8px', marginTop:'12px' },
  actP:    { flex:1, padding:'7px', borderRadius:'7px', border:'none', background:'#1B2A4A', fontSize:'12px', fontWeight:600, cursor:'pointer', color:'white', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' },
  actS:    { flex:1, padding:'7px', borderRadius:'7px', border:'1px solid #e2e8f0', background:'white', fontSize:'12px', fontWeight:600, cursor:'pointer', color:'#1B2A4A', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' },
  empty:   { textAlign:'center', padding:'60px 20px', color:'#94a3b8' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:50, overflowY:'auto', padding:'20px' },
  modal:   { background:'white', borderRadius:'12px', padding:'24px', width:'580px', maxWidth:'95vw', position:'relative', marginTop:'20px', marginBottom:'20px' },
  mTitle:  { fontSize:'18px', fontWeight:700, color:'#1B2A4A', marginBottom:'16px' },
  label:   { display:'block', fontSize:'12px', fontWeight:600, color:'#374151', marginBottom:'4px' },
  input:   { width:'100%', padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:'7px', fontSize:'13px', marginBottom:'12px', outline:'none', boxSizing:'border-box' },
  select:  { width:'100%', padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:'7px', fontSize:'13px', marginBottom:'12px', outline:'none', boxSizing:'border-box', background:'white' },
  row2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' },
  row3:    { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' },
  hint:    { fontSize:'11px', color:'#94a3b8', marginTop:'-8px', marginBottom:'12px' },
  section: { borderTop:'1px solid #f1f5f9', marginTop:'4px', paddingTop:'14px', marginBottom:'8px' },
  secLbl:  { fontSize:'13px', fontWeight:700, color:'#1B2A4A', marginBottom:'12px' },
  savBtn:  { width:'100%', padding:'10px', background:'#1B2A4A', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:600, cursor:'pointer', marginTop:'8px' },
  addBtn:  { display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', background:'#EAF1FA', color:'#1B2A4A', border:'1px solid #b8cde8', borderRadius:'7px', fontSize:'12px', fontWeight:600, cursor:'pointer', marginBottom:'12px' },
  calcBox: { background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'7px', padding:'10px 12px', marginBottom:'12px', fontSize:'12px' },
  calcRow: { display:'flex', justifyContent:'space-between', marginBottom:'3px' },
}

function NewProjectModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:'', location:'', taluk:'', district:'', region:'',
    unit_of_measure:'sqft', approval_auth:'DTCP', approval_no:'', rera_no:'',
    total_area_acres:'', total_area_sqft:'', saleable_area_sqft:'',
    guideline_value_sqft:'', guideline_value_cent:'',
    sale_rate_per_cent:'', sale_rate_per_sqft:'',
    landowner_rate_per_cent:'', landowner_rate_per_sqft:'',
    total_plots:'', is_jv:false,
  })
  const [landowners, setLandowners] = useState([{ name:'', share_pct:'', account_no:'', ifsc_code:'', bank_name:'' }])

  const isCents = form.unit_of_measure === 'cents'

  const set = (k, v) => setForm(f => {
    const u = { ...f, [k]: v }
    if (k === 'region' && REGION_UNITS[v]) u.unit_of_measure = REGION_UNITS[v]
    if (k === 'total_area_acres' && v) u.total_area_sqft = (parseFloat(v) * ACRES_TO_SQFT).toFixed(2)
    if (k === 'total_area_sqft' && v) u.total_area_acres = (parseFloat(v) / ACRES_TO_SQFT).toFixed(4)
    /*if (k === 'guideline_value_sqft' && v) u.guideline_value_cent = (parseFloat(v) * CENTS_TO_SQFT).toFixed(2)
    if (k === 'guideline_value_cent' && v) u.guideline_value_sqft = (parseFloat(v) / CENTS_TO_SQFT).toFixed(2)*/
    if (k === 'sale_rate_per_cent' && v) u.sale_rate_per_sqft = Math.round((parseFloat(v) / CENTS_TO_SQFT) / 50) * 50
    if (k === 'sale_rate_per_sqft' && v) u.sale_rate_per_cent = Math.round((parseFloat(v) * CENTS_TO_SQFT) / 100) * 100
    if (k === 'landowner_rate_per_cent' && v) u.landowner_rate_per_sqft = Math.round((parseFloat(v) / CENTS_TO_SQFT) / 50) * 50
    if (k === 'landowner_rate_per_sqft' && v) u.landowner_rate_per_cent = Math.round((parseFloat(v) * CENTS_TO_SQFT) / 100) * 100
    return u
  })

  const addLO = () => setLandowners(l => [...l, { name:'', share_pct:'', account_no:'', ifsc_code:'', bank_name:'' }])
  const removeLO = (i) => setLandowners(l => l.filter((_,idx) => idx !== i))
  const setLO = (i, k, v) => setLandowners(l => l.map((lo, idx) => idx === i ? {...lo,[k]:v} : lo))
  const totalLOShare = landowners.reduce((s,lo) => s + (parseFloat(lo.share_pct)||0), 0)

  // Example calc using 1 cent / 435.6 sqft for preview
  const exCents = 1
  const exSqft = CENTS_TO_SQFT
  const salePerCent = parseFloat(form.sale_rate_per_cent) || 0
  const loPerCent = parseFloat(form.landowner_rate_per_cent) || 0
  const glvPerSqft = parseFloat(form.guideline_value_sqft) || 0
  const exSaleTotal = isCents ? exCents * salePerCent : exSqft * (parseFloat(form.sale_rate_per_sqft)||0)
  const exLOTotal = isCents ? exCents * loPerCent : exSqft * (parseFloat(form.landowner_rate_per_sqft)||0)
  const exCustPaysLO = exSqft * glvPerSqft
  const exCustPaysKSR = exSaleTotal - exCustPaysLO
  const exKSRPaysLO = exLOTotal - exCustPaysLO

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error('Project name is required')
      if (form.is_jv && totalLOShare > 100) throw new Error('Landowner shares add up to more than 100% of the GLV pool — please adjust')

      const { data: proj, error } = await supabase.from('projects').insert({
        name: form.name,
        location: form.location || null,
        taluk: form.taluk || null,
        district: form.district || null,
        region: form.region || null,
        unit_of_measure: form.unit_of_measure,
        approval_auth: form.approval_auth || null,
        approval_no: form.approval_no || null,
        rera_no: form.rera_no || null,
        total_area_acres: form.total_area_acres ? parseFloat(form.total_area_acres) : null,
        total_area_sqft: form.total_area_sqft ? parseFloat(form.total_area_sqft) : null,
        saleable_area_sqft: form.saleable_area_sqft ? parseFloat(form.saleable_area_sqft) : null,
        guideline_value_sqft: form.guideline_value_sqft ? parseFloat(form.guideline_value_sqft) : null,
        guideline_value_cent: form.guideline_value_cent ? parseFloat(form.guideline_value_cent) : null,
        sale_rate_per_cent: form.sale_rate_per_cent ? parseFloat(form.sale_rate_per_cent) : null,
        sale_rate_per_sqft: form.sale_rate_per_sqft ? parseFloat(form.sale_rate_per_sqft) : null,
        landowner_rate_per_cent: form.landowner_rate_per_cent ? parseFloat(form.landowner_rate_per_cent) : null,
        landowner_rate_per_sqft: form.landowner_rate_per_sqft ? parseFloat(form.landowner_rate_per_sqft) : null,
        total_plots: form.total_plots ? parseInt(form.total_plots) : null,
        is_jv: form.is_jv,
        status: 'on_hold', // new projects start on hold until verified, then made active
      }).select().single()
      if (error) throw error

      if (form.is_jv && landowners.filter(lo=>lo.name).length > 0) {
        const loRows = landowners.filter(lo=>lo.name).map((lo, i) => ({
          project_id: proj.id,
          landowner_name: lo.name,
          share_pct: parseFloat(lo.share_pct) || 0,
          account_no: lo.account_no || null,
          ifsc_code: lo.ifsc_code || null,
          bank_name: lo.bank_name || null,
          sort_order: i + 1,
        }))
        const { error: loErr } = await supabase.from('project_landowners').insert(loRows)
        if (loErr) throw loErr
      }
    },
    onSuccess: () => { toast.success('Project created'); qc.invalidateQueries(['projects']); onClose() },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',cursor:'pointer',color:'#94a3b8'}}><X size={18}/></button>
        <div style={S.mTitle}>New Project</div>

        {/* Basic */}
        <label style={S.label}>Project Name *</label>
        <input style={S.input} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. KSR Kodaikanal Township" />

        <div style={S.row2}>
          <div>
            <label style={S.label}>Region</label>
            <select style={S.select} value={form.region} onChange={e=>set('region',e.target.value)}>
              <option value="">Select region</option>
              {REGIONS.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Unit of Measure</label>
            <select style={S.select} value={form.unit_of_measure} onChange={e=>set('unit_of_measure',e.target.value)}>
              <option value="sqft">Sq.ft</option>
              <option value="cents">Cents</option>
            </select>
          </div>
        </div>

        <div style={S.row3}>
          <div><label style={S.label}>Location / Village</label><input style={S.input} value={form.location} onChange={e=>set('location',e.target.value)} /></div>
          <div><label style={S.label}>Taluk</label><input style={S.input} value={form.taluk} onChange={e=>set('taluk',e.target.value)} /></div>
          <div><label style={S.label}>District</label><input style={S.input} value={form.district} onChange={e=>set('district',e.target.value)} /></div>
        </div>

        {/* Area */}
        <div style={S.section}><div style={S.secLbl}>Area</div></div>
        <div style={S.row3}>
          <div><label style={S.label}>Total Area (Acres)</label><input style={S.input} type="number" value={form.total_area_acres} onChange={e=>set('total_area_acres',e.target.value)} /></div>
          <div><label style={S.label}>Total Area (Sq.ft)</label><input style={S.input} type="number" value={form.total_area_sqft} onChange={e=>set('total_area_sqft',e.target.value)} placeholder="Auto from acres" /></div>
          <div><label style={S.label}>Saleable Area (Sq.ft)</label><input style={S.input} type="number" value={form.saleable_area_sqft} onChange={e=>set('saleable_area_sqft',e.target.value)} /></div>
        </div>

        {/* Rates */}
        <div style={S.section}><div style={S.secLbl}>Rates & Guideline Value</div></div>
        <div style={S.row2}>
          <div>
            <label style={S.label}>Sale Rate / Cent (₹)</label>
            <input style={S.input} type="number" value={form.sale_rate_per_cent} onChange={e=>set('sale_rate_per_cent',e.target.value)} placeholder="e.g. 830000" />
          </div>
          <div>
            <label style={S.label}>Sale Rate / Sq.ft (₹)</label>
            <input style={S.input} type="number" value={form.sale_rate_per_sqft} onChange={e=>set('sale_rate_per_sqft',e.target.value)} placeholder="Auto-calculated" />
          </div>
        </div>
        {form.is_jv && (
        <div style={S.row2}>
          <div>
            <label style={S.label}>Landowner Rate / Cent (₹)</label>
            <input style={S.input} type="number" value={form.landowner_rate_per_cent} onChange={e=>set('landowner_rate_per_cent',e.target.value)} placeholder="e.g. 770000" />
          </div>
        
          <div>
            <label style={S.label}>Landowner Rate / Sq.ft (₹)</label>
            <input style={S.input} type="number" value={form.landowner_rate_per_sqft} onChange={e=>set('landowner_rate_per_sqft',e.target.value)} placeholder="Auto-calculated" />
          </div>
        </div>
        )}
        <div style={S.row2}>
          <div>
            <label style={S.label}>GLV / Sq.ft (₹)</label>
            <input style={S.input} type="number" value={form.guideline_value_sqft} onChange={e=>set('guideline_value_sqft',e.target.value)} placeholder="e.g. 750" />
          </div>
        </div>
        <p style={S.hint}>1 Cent = 435.6 Sq.ft — values auto-calculate in both directions</p>

        {/* Rate preview */}
        {form.is_jv && (salePerCent > 0 || glvPerSqft > 0) && (
        <div style={S.calcBox}>
          <div style={{fontWeight:600, color:'#166534', marginBottom:'6px'}}>Per 1 Cent (435.6 Sq.ft) preview:</div>
          {exSaleTotal > 0 && <div style={S.calcRow}><span>Total sale value</span><span style={{fontWeight:600}}>{fmt(exSaleTotal)}</span></div>}
          {form.is_jv && exCustPaysLO > 0 && <div style={S.calcRow}><span>Customer → Landowners (GLV)</span><span>{fmt(exCustPaysLO)}</span></div>}
          {exCustPaysKSR > 0 && <div style={S.calcRow}><span>Customer → KSR</span><span>{fmt(exCustPaysKSR)}</span></div>}
          {form.is_jv && exKSRPaysLO > 0 && <div style={S.calcRow}><span>KSR → Landowners (later)</span><span>{fmt(exKSRPaysLO)}</span></div>}
        </div>
        )}
        {/* Approval */}
        <div style={S.section}><div style={S.secLbl}>Approval & Registration</div></div>
        <div style={S.row3}>
          <div>
            <label style={S.label}>Authority</label>
            <select style={S.select} value={form.approval_auth} onChange={e=>set('approval_auth',e.target.value)}>
              <option>DTCP</option><option>CMDA</option><option>LPA</option><option>Other</option>
            </select>
          </div>
          <div><label style={S.label}>Approval No.</label><input style={S.input} value={form.approval_no} onChange={e=>set('approval_no',e.target.value)} /></div>
          <div><label style={S.label}>RERA No.</label><input style={S.input} value={form.rera_no} onChange={e=>set('rera_no',e.target.value)} /></div>
        </div>

        <div style={S.row2}>
          <div><label style={S.label}>Total Plots</label><input style={S.input} type="number" value={form.total_plots} onChange={e=>set('total_plots',e.target.value)} /></div>
          <div style={{display:'flex',alignItems:'center',gap:'8px',paddingTop:'20px'}}>
            <input type="checkbox" id="is_jv" checked={form.is_jv} onChange={e=>set('is_jv',e.target.checked)} style={{width:'16px',height:'16px',cursor:'pointer'}}/>
            <label htmlFor="is_jv" style={{fontSize:'13px',fontWeight:600,color:'#374151',cursor:'pointer'}}>Joint Venture (JV)</label>
          </div>
        </div>

        {/* Landowners */}
        {form.is_jv && (
          <>
            <div style={S.section}><div style={S.secLbl}>Landowners</div></div>
            {landowners.map((lo, i) => (
              <div key={i} style={{background:'#f8fafc',borderRadius:'8px',padding:'12px',marginBottom:'10px',position:'relative'}}>
                <div style={{fontSize:'12px',fontWeight:600,color:'#1B2A4A',marginBottom:'8px'}}>Landowner {i+1}</div>
                <div style={S.row2}>
                  <div><label style={S.label}>Name *</label><input style={S.input} value={lo.name} onChange={e=>setLO(i,'name',e.target.value)} placeholder="Full name" /></div>
                  <div><label style={S.label}>Share %</label><input style={{...S.input}} type="number" value={lo.share_pct} onChange={e=>setLO(i,'share_pct',e.target.value)} placeholder="e.g. 25" /></div>
                </div>
                <div style={S.row3}>
                  <div><label style={S.label}>Bank Name</label><input style={S.input} value={lo.bank_name} onChange={e=>setLO(i,'bank_name',e.target.value)} placeholder="Optional" /></div>
                  <div><label style={S.label}>Account No.</label><input style={S.input} value={lo.account_no} onChange={e=>setLO(i,'account_no',e.target.value)} placeholder="Optional" /></div>
                  <div><label style={S.label}>IFSC Code</label><input style={S.input} value={lo.ifsc_code} onChange={e=>setLO(i,'ifsc_code',e.target.value)} placeholder="Optional" /></div>
                </div>
                {landowners.length > 1 && (
                  <button onClick={()=>removeLO(i)} style={{position:'absolute',top:'12px',right:'12px',background:'none',border:'none',cursor:'pointer',color:'#ef4444'}}><Trash2 size={14}/></button>
                )}
              </div>
            ))}
            <button style={S.addBtn} onClick={addLO}><Plus size={13}/> Add Landowner</button>
            <div style={{background:'#EAF1FA',borderRadius:'7px',padding:'10px 12px',marginBottom:'12px',fontSize:'13px'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'#64748b'}}>Total landowner share (of GLV pool)</span>
                <span style={{fontWeight:600,color:totalLOShare>100?'#ef4444':(totalLOShare===100?'#16a34a':'#1B2A4A')}}>{totalLOShare.toFixed(2)}%</span>
              </div>
              <p style={{fontSize:'11px',color:'#94a3b8',margin:'6px 0 0'}}>This should total 100% — it's how the GLV amount (paid directly by the customer) is split across landowners. KSR's own share is calculated separately from the sale rate, not from this percentage.</p>
            </div>
          </>
        )}

        <button style={S.savBtn} onClick={()=>save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Create Project'}
        </button>
      </div>
    </div>
  )
}

export default function Projects() {
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Live plot counts per project — source of truth is the actual `plots`
  // table, not the manually-typed total_plots field on the project, which
  // can drift out of sync (e.g. plots added later, imports, deletions).
  const { data: plotStats = {} } = useQuery({
    queryKey: ['plot-counts-by-project'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plots').select('project_id, polygon_coords').eq('plot_type', 'plot')
      if (error) throw error
      const counts = {}
      const hasDrawing = {}
      for (const p of data) {
        counts[p.project_id] = (counts[p.project_id] || 0) + 1
        if (Array.isArray(p.polygon_coords) && p.polygon_coords.length > 0) hasDrawing[p.project_id] = true
      }
      return { counts, hasDrawing }
    },
  })
  const plotCounts = plotStats.counts || {}
  const hasDrawing = plotStats.hasDrawing || {}

  const stats = (proj) => ({
    total: plotCounts[proj.id] ?? proj.total_plots ?? 0,
    available: 0, booked: 0, registered: 0,
  })

  return (
    <div style={S.page}>
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}

      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Projects</h1>
          <p style={S.sub}>Manage all KSR real estate projects</p>
        </div>
        <button style={S.btn} onClick={() => setShowNew(true)}><Plus size={15}/> New Project</button>
      </div>

      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:'220px'}}>
          <Search size={16} style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
          <input
            type="text"
            placeholder="Search by name, region, or location..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'8px 10px 8px 32px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e=>setStatusFilter(e.target.value)}
          style={{padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',background:'white'}}
        >
          <option value="All">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {(() => {
        const q = search.toLowerCase()
        const filteredProjects = (projects || []).filter(p => {
          const matchesStatus = statusFilter === 'All' || p.status === statusFilter
          const matchesSearch = !q ||
            p.name?.toLowerCase().includes(q) ||
            p.region?.toLowerCase().includes(q) ||
            p.location?.toLowerCase().includes(q) ||
            p.taluk?.toLowerCase().includes(q) ||
            p.district?.toLowerCase().includes(q)
          return matchesStatus && matchesSearch
        })
        return isLoading ? (
        <div style={S.empty}>Loading...</div>
      ) : !projects?.length ? (
        <div style={S.empty}>
          <Building2 size={40} style={{margin:'0 auto 12px',display:'block',opacity:0.3}}/>
          <p style={{fontWeight:600,color:'#475569'}}>No projects yet</p>
        </div>
      ) : !filteredProjects.length ? (
        <div style={S.empty}>
          <Search size={40} style={{margin:'0 auto 12px',display:'block',opacity:0.3}}/>
          <p style={{fontWeight:600,color:'#475569'}}>No projects match your search</p>
        </div>
      ) : (
        <div style={S.grid}>
          {filteredProjects.map(proj => {
            const isCents = proj.unit_of_measure === 'cents'
            return (
              <div key={proj.id} style={S.card}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'8px'}}>
                  <div>
                    <div style={{fontSize:'16px',fontWeight:700,color:'#1B2A4A'}}>{proj.name}</div>
                    <div style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>
                      {[proj.region, proj.location, proj.district].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap',justifyContent:'flex-end'}}>
                    <span style={S.badge(proj.status)}>{STATUS_LABELS[proj.status] || proj.status}</span>
                    {proj.is_jv && <span style={S.jvBadge}>JV</span>}
                  </div>
                </div>

                <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'10px'}}>
                  {proj.unit_of_measure === 'cents' ? 'Cents' : 'Sq.ft'}
                  {proj.unit_of_measure === 'cents' && proj.sale_rate_per_cent && ` · Sale: ${fmt(proj.sale_rate_per_cent)}/Cent`}
                  {proj.unit_of_measure !== 'cents' && proj.sale_rate_per_sqft && ` · Sale: ${fmt(proj.sale_rate_per_sqft)}/Sq.ft`}
                  {proj.guideline_value_sqft && ` · GLV: ${fmt(proj.guideline_value_sqft)}/Sq.ft`}
                </div>

                {proj.approval_no && (
                  <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'10px'}}>
                    {proj.approval_auth} — {proj.approval_no}
                  </div>
                )}

                <div style={{display:'flex',gap:'6px',background:'#f8fafc',borderRadius:'8px',padding:'8px',marginBottom:'12px'}}>
                  {(() => {
                    const added = plotCounts[proj.id] ?? 0
                    const planned = proj.total_plots
                    const plotsLabel = planned ? 'Plots Added' : 'Total'
                    const plotsValue = planned ? `${added} / ${planned}` : added
                    return [
                      [plotsLabel, plotsValue],
                      ['Saleable', proj.saleable_area_sqft ? `${(proj.saleable_area_sqft/1000).toFixed(1)}k sqft` : '—'],
                    ]
                  })().map(([l,v])=>(
                    <div key={l} style={S.stat}>
                      <div style={{...S.statN, fontSize: String(v).includes('/') ? '16px' : '20px'}}>{v}</div>
                      <div style={S.statL}>{l}</div>
                    </div>
                  ))}
                </div>

                <div style={S.actions}>
                  {hasDrawing[proj.id] ? (
                    <Link to={`/projects/${proj.id}/inventory`} style={{flex:1,textDecoration:'none'}}>
                      <button style={{...S.actP,width:'100%'}}><Map size={13}/> Inventory</button>
                    </Link>
                  ) : (
                    <button
                      disabled
                      title="No drawing uploaded yet for this project"
                      style={{...S.actP,width:'100%',flex:1,opacity:0.4,cursor:'not-allowed'}}
                    >
                      <Map size={13}/> Inventory
                    </button>
                  )}
                  <Link to={`/projects/${proj.id}`} style={{flex:1,textDecoration:'none'}}>
                    <button style={{...S.actS,width:'100%'}}>Details <ChevronRight size={13}/></button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )
      })()}
    </div>
  )
}
