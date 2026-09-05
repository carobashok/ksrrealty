import React, { useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Map, Pencil, X, Check, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import DocumentsPanel from '../components/DocumentsPanel'

const CENTS_TO_SQFT = 435.6
const fmt  = (n) => n ? '₹' + Math.round(parseFloat(n)).toLocaleString('en-IN') : '—'
const fmtN = (n) => n ? parseFloat(n).toLocaleString('en-IN') : '—'

const Row = ({ label, value }) => (
  <div style={{display:'flex',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f1f5f9'}}>
    <div style={{width:'220px',flexShrink:0,fontSize:'13px',color:'#64748b'}}>{label}</div>
    <div style={{fontSize:'13px',fontWeight:500,color:'#1B2A4A',flex:1}}>{value ?? '—'}</div>
  </div>
)

const Section = ({ title, action, children }) => (
  <div style={{background:'white',borderRadius:'10px',padding:'20px',border:'1px solid #e2e8f0',marginBottom:'16px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px',paddingBottom:'8px',borderBottom:'1px solid #f1f5f9'}}>
      <div style={{fontSize:'14px',fontWeight:700,color:'#1B2A4A'}}>{title}</div>
      {action}
    </div>
    {children}
  </div>
)

const EditBtn = ({ onClick }) => (
  <button onClick={onClick} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'1px solid #e2e8f0',borderRadius:'6px',background:'white',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#1B2A4A'}}>
    <Pencil size={12}/> Edit
  </button>
)

const SaveCancel = ({ onSave, onCancel, saving }) => (
  <div style={{display:'flex',gap:'6px'}}>
    <button onClick={onSave} disabled={saving} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'none',borderRadius:'6px',background:'#1B2A4A',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'white'}}>
      <Check size={12}/> {saving ? 'Saving…' : 'Save'}
    </button>
    <button onClick={onCancel} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'1px solid #e2e8f0',borderRadius:'6px',background:'white',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#64748b'}}>
      <X size={12}/> Cancel
    </button>
  </div>
)

const inp = {width:'100%',padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}
const sel = {width:'100%',padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box',background:'white'}
const lbl = {fontSize:'13px',color:'#64748b',width:'220px',flexShrink:0}

// ── Rates Section ──────────────────────────────────────────────────────────
function RatesSection({ proj, projectId, qc }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    sale_rate_per_cent: proj.sale_rate_per_cent || '',
    sale_rate_per_sqft: proj.sale_rate_per_sqft || '',
    landowner_rate_per_cent: proj.landowner_rate_per_cent || '',
    landowner_rate_per_sqft: proj.landowner_rate_per_sqft || '',
    guideline_value_sqft: proj.guideline_value_sqft || '',
    incentive_amount_per_plot: proj.incentive_amount_per_plot || '',
    reg_charge_pct: proj.reg_charge_pct ?? 9,
    document_charge_amount: proj.document_charge_amount || '',
    latitude:  proj.latitude  || '',
    longitude: proj.longitude || '',
  })

  const set = (k, v) => setForm(f => {
    const u = { ...f, [k]: v }
    if (k === 'sale_rate_per_cent' && v) u.sale_rate_per_sqft = Math.round((parseFloat(v) / CENTS_TO_SQFT) / 50) * 50
    if (k === 'sale_rate_per_sqft' && v) u.sale_rate_per_cent = Math.round((parseFloat(v) * CENTS_TO_SQFT) / 100) * 100
    if (k === 'landowner_rate_per_cent' && v) u.landowner_rate_per_sqft = Math.round((parseFloat(v) / CENTS_TO_SQFT) / 50) * 50
    if (k === 'landowner_rate_per_sqft' && v) u.landowner_rate_per_cent = Math.round((parseFloat(v) * CENTS_TO_SQFT) / 100) * 100
    return u
  })

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('projects').update({
        sale_rate_per_cent:      form.sale_rate_per_cent      ? parseFloat(form.sale_rate_per_cent)      : null,
        sale_rate_per_sqft:      form.sale_rate_per_sqft      ? parseFloat(form.sale_rate_per_sqft)      : null,
        landowner_rate_per_cent: form.landowner_rate_per_cent ? parseFloat(form.landowner_rate_per_cent) : null,
        landowner_rate_per_sqft: form.landowner_rate_per_sqft ? parseFloat(form.landowner_rate_per_sqft) : null,
        guideline_value_sqft:    form.guideline_value_sqft    ? parseFloat(form.guideline_value_sqft)    : null,
        incentive_amount_per_plot: form.incentive_amount_per_plot ? parseFloat(form.incentive_amount_per_plot) : null,
        reg_charge_pct: form.reg_charge_pct ? parseFloat(form.reg_charge_pct) : null,
        document_charge_amount: form.document_charge_amount ? parseFloat(form.document_charge_amount) : null,
        latitude:  form.latitude  ? parseFloat(form.latitude)  : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      }).eq('id', projectId)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Rates updated'); qc.invalidateQueries(['project', projectId]); setEditing(false) },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Section title="Rates & Guideline Value"
      action={!editing
        ? <EditBtn onClick={() => setEditing(true)} />
        : <SaveCancel onSave={() => save.mutate()} onCancel={() => setEditing(false)} saving={save.isPending} />
      }>
      {!editing ? (
        <>
          <Row label="Sale Rate / Cent" value={fmt(proj.sale_rate_per_cent)} />
          <Row label="Sale Rate / Sq.ft" value={fmt(proj.sale_rate_per_sqft)} />
          {proj.is_jv && <Row label="Landowner Rate / Cent" value={fmt(proj.landowner_rate_per_cent)} />}
          {proj.is_jv && <Row label="Landowner Rate / Sq.ft" value={fmt(proj.landowner_rate_per_sqft)} />}
          <Row label="GLV / Sq.ft" value={fmt(proj.guideline_value_sqft)} />
          <Row label="Incentive / Plot" value={fmt(proj.incentive_amount_per_plot)} />
          <Row label="Reg Charge" value={proj.reg_charge_pct ? `${proj.reg_charge_pct}% of GLV Total` : '—'} />
          <Row label="Document Charge" value={fmt(proj.document_charge_amount)} />
        </>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {[['Sale Rate / Cent (₹)','sale_rate_per_cent'],['Sale Rate / Sq.ft (₹)','sale_rate_per_sqft']].map(([label,key])=>(
            <div key={key} style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={lbl}>{label}</div>
              <input style={inp} type="number" value={form[key]} onChange={e=>set(key,e.target.value)} />
            </div>
          ))}
          {proj.is_jv && [['Landowner Rate / Cent (₹)','landowner_rate_per_cent'],['Landowner Rate / Sq.ft (₹)','landowner_rate_per_sqft']].map(([label,key])=>(
            <div key={key} style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={lbl}>{label}</div>
              <input style={inp} type="number" value={form[key]} onChange={e=>set(key,e.target.value)} />
            </div>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={lbl}>GLV / Sq.ft (₹)</div>
            <input style={inp} type="number" value={form.guideline_value_sqft} onChange={e=>set('guideline_value_sqft',e.target.value)} />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={lbl}>Incentive / Plot (₹)</div>
            <input style={inp} type="number" value={form.incentive_amount_per_plot} onChange={e=>set('incentive_amount_per_plot',e.target.value)} />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={lbl}>Reg Charge (% of GLV Total)</div>
            <input style={inp} type="number" step="0.01" value={form.reg_charge_pct} onChange={e=>set('reg_charge_pct',e.target.value)} />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={lbl}>Document Charge (₹)</div>
            <input style={inp} type="number" value={form.document_charge_amount} onChange={e=>set('document_charge_amount',e.target.value)} />
          </div>
          <p style={{fontSize:'11px',color:'#94a3b8',margin:0}}>Reg Charge is calculated on GLV Total (not Land Cost); Document Charge is flat. Both are added on top of Land Cost to arrive at the quotation total, and are uniform across every plot in this project.</p>
          {/* Location coordinates */}
          <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:'#94a3b8',marginBottom:'6px',letterSpacing:'0.05em'}}>MAP LOCATION</div>
            {editing ? (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                {[['Latitude','latitude'],['Longitude','longitude']].map(([label,key])=>(
                  <div key={key}>
                    <div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>{label}</div>
                    <input style={inp} type="number" step="0.0000001"
                      value={form[key]}
                      onChange={e=>set(key,e.target.value)}
                      placeholder={key==='latitude' ? '11.0168' : '76.9558'}
                    />
                  </div>
                ))}
                <div style={{gridColumn:'1/-1',fontSize:'11px',color:'#94a3b8'}}>
                  💡 Right-click the project site on Google Maps → "What's here?" to get coordinates.
                </div>
              </div>
            ) : (
              proj.latitude && proj.longitude ? (
                <div style={{fontSize:'13px',color:'#475569'}}>
                  📍 {proj.latitude}, {proj.longitude}
                  <a href={`https://www.google.com/maps?q=${proj.latitude},${proj.longitude}`}
                    target="_blank" rel="noreferrer"
                    style={{marginLeft:'8px',fontSize:'12px',color:'#4A7EB5'}}>
                    View on Google Maps ↗
                  </a>
                </div>
              ) : (
                <div style={{fontSize:'12px',color:'#94a3b8'}}>
                  No coordinates set — click Edit Rates to add location for the map view.
                </div>
              )
            )}
          </div>
          <p style={{fontSize:'11px',color:'#94a3b8',margin:0}}>Flat incentive pool per plot, split among employees at booking time (same amount for every plot in this project)</p>
          <p style={{fontSize:'11px',color:'#94a3b8',margin:0}}>Cent ↔ Sq.ft values auto-calculate (1 Cent = 435.6 Sq.ft)</p>
        </div>
      )}
    </Section>
  )
}

// ── Project Details Section ────────────────────────────────────────────────
function DetailsSection({ proj, projectId, qc }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: proj.name || '',
    region: proj.region || '',
    unit_of_measure: proj.unit_of_measure || 'sqft',
    location: proj.location || '',
    taluk: proj.taluk || '',
    district: proj.district || '',
    total_plots: proj.total_plots || '',
    approval_auth: proj.approval_auth || 'DTCP',
    approval_no: proj.approval_no || '',
    rera_no: proj.rera_no || '',
    total_area_acres: proj.total_area_acres || '',
    total_area_sqft: proj.total_area_sqft || '',
    saleable_area_sqft: proj.saleable_area_sqft || '',
    is_jv: proj.is_jv || false,
  })

  const set = (k, v) => setForm(f => {
    const u = { ...f, [k]: v }
    if (k === 'total_area_acres' && v) u.total_area_sqft = (parseFloat(v) * 43560).toFixed(2)
    if (k === 'total_area_sqft' && v) u.total_area_acres = (parseFloat(v) / 43560).toFixed(4)
    return u
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Project name is required')
      const { error } = await supabase.from('projects').update({
        name: form.name.trim(),
        region: form.region || null,
        unit_of_measure: form.unit_of_measure,
        location: form.location || null,
        taluk: form.taluk || null,
        district: form.district || null,
        total_plots: form.total_plots ? parseInt(form.total_plots) : null,
        approval_auth: form.approval_auth || null,
        approval_no: form.approval_no || null,
        rera_no: form.rera_no || null,
        total_area_acres: form.total_area_acres ? parseFloat(form.total_area_acres) : null,
        total_area_sqft: form.total_area_sqft ? parseFloat(form.total_area_sqft) : null,
        saleable_area_sqft: form.saleable_area_sqft ? parseFloat(form.saleable_area_sqft) : null,
        is_jv: form.is_jv,
      }).eq('id', projectId)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Project updated'); qc.invalidateQueries(['project', projectId]); setEditing(false) },
    onError: (e) => toast.error(e.message),
  })

  const REGIONS = ['Chennai','Chengalpattu','Tiruvallur','Vellore','Coimbatore','Tiruchy','Madurai','Salem','Kodaikanal','Ooty','Other']

  return (
    <Section title="Project Details"
      action={!editing
        ? <EditBtn onClick={() => setEditing(true)} />
        : <SaveCancel onSave={() => save.mutate()} onCancel={() => setEditing(false)} saving={save.isPending} />
      }>
      {!editing ? (
        <>
          <Row label="Project Name" value={proj.name} />
          <Row label="Region" value={proj.region} />
          <Row label="Unit of Measure" value={proj.unit_of_measure === 'cents' ? 'Cents' : 'Sq.ft'} />
          <Row label="Joint Venture (JV)" value={proj.is_jv ? '✅ Yes' : 'No'} />
          <Row label="Location / Village" value={proj.location} />
          <Row label="Taluk" value={proj.taluk} />
          <Row label="District" value={proj.district} />
          <Row label="Total Plots" value={proj.total_plots} />
          <Row label="Total Area" value={proj.total_area_acres ? `${proj.total_area_acres} Acres (${fmtN(proj.total_area_sqft)} Sq.ft)` : null} />
          <Row label="Saleable Area" value={proj.saleable_area_sqft ? `${fmtN(proj.saleable_area_sqft)} Sq.ft` : null} />
          <Row label="Approval Authority" value={proj.approval_auth} />
          <Row label="Approval No." value={proj.approval_no} />
          <Row label="RERA No." value={proj.rera_no} />
        </>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {/* Project Name */}
          <div>
            <div style={{...lbl,marginBottom:'4px'}}>Project Name</div>
            <input style={inp} value={form.name} onChange={e=>set('name',e.target.value)} />
          </div>
          {/* Region + Unit */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div>
              <div style={{...lbl,marginBottom:'4px'}}>Region</div>
              <select style={sel} value={form.region} onChange={e=>set('region',e.target.value)}>
                <option value="">Select</option>
                {REGIONS.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{...lbl,marginBottom:'4px'}}>Unit of Measure</div>
              <select style={sel} value={form.unit_of_measure} onChange={e=>set('unit_of_measure',e.target.value)}>
                <option value="sqft">Sq.ft</option>
                <option value="cents">Cents</option>
              </select>
            </div>
          </div>
          {/* JV toggle */}
          <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0'}}>
            <input type="checkbox" id="jv_edit" checked={form.is_jv} onChange={e=>set('is_jv',e.target.checked)} style={{width:'16px',height:'16px',cursor:'pointer'}}/>
            <label htmlFor="jv_edit" style={{fontSize:'13px',fontWeight:600,color:'#374151',cursor:'pointer'}}>Joint Venture (JV) Project</label>
          </div>
          {/* Location */}
          {[['Location / Village','location'],['Taluk','taluk'],['District','district']].map(([label,key])=>(
            <div key={key} style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={lbl}>{label}</div>
              <input style={inp} value={form[key]} onChange={e=>set(key,e.target.value)} />
            </div>
          ))}
          {/* Area */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
            <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>Total Plots</div><input style={inp} type="number" value={form.total_plots} onChange={e=>set('total_plots',e.target.value)} /></div>
            <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>Total Area (Acres)</div><input style={inp} type="number" value={form.total_area_acres} onChange={e=>set('total_area_acres',e.target.value)} /></div>
            <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>Saleable Area (Sq.ft)</div><input style={inp} type="number" value={form.saleable_area_sqft} onChange={e=>set('saleable_area_sqft',e.target.value)} /></div>
          </div>
          {/* Approval */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
            <div>
              <div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>Approval Auth</div>
              <select style={sel} value={form.approval_auth} onChange={e=>set('approval_auth',e.target.value)}>
                <option>DTCP</option><option>CMDA</option><option>LPA</option><option>Other</option>
              </select>
            </div>
            <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>Approval No.</div><input style={inp} value={form.approval_no} onChange={e=>set('approval_no',e.target.value)} /></div>
            <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'4px'}}>RERA No.</div><input style={inp} value={form.rera_no} onChange={e=>set('rera_no',e.target.value)} /></div>
          </div>
        </div>
      )}
    </Section>
  )
}

// ── Landowners Section ─────────────────────────────────────────────────────
function LandownersSection({ proj, projectId, qc }) {
  const [adding, setAdding] = useState(false)
  const [newLO, setNewLO] = useState({ landowner_name:'', share_pct:'', bank_name:'', account_no:'', ifsc_code:'' })

  const { data: landowners, refetch } = useQuery({
    queryKey: ['landowners', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_landowners').select('*').eq('project_id', projectId).order('sort_order')
      if (error) throw error
      return data
    },
  })

  const addLO = useMutation({
    mutationFn: async () => {
      if (!newLO.landowner_name) throw new Error('Name is required')
      const { error } = await supabase.from('project_landowners').insert({
        project_id: projectId,
        landowner_name: newLO.landowner_name,
        share_pct: parseFloat(newLO.share_pct) || 0,
        bank_name: newLO.bank_name || null,
        account_no: newLO.account_no || null,
        ifsc_code: newLO.ifsc_code || null,
        sort_order: (landowners?.length || 0) + 1,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Landowner added'); refetch(); setAdding(false); setNewLO({ landowner_name:'', share_pct:'', bank_name:'', account_no:'', ifsc_code:'' }) },
    onError: (e) => toast.error(e.message),
  })

  const deleteLO = async (id) => {
    if (!window.confirm('Remove this landowner?')) return
    const { error } = await supabase.from('project_landowners').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Landowner removed'); refetch() }
  }

  const totalShare = landowners?.reduce((s,lo) => s + parseFloat(lo.share_pct||0), 0) || 0

  if (!proj.is_jv) return null

  return (
    <Section title="Landowners"
      action={<button onClick={() => setAdding(a=>!a)} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'1px solid #b8cde8',borderRadius:'6px',background:'#EAF1FA',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#1B2A4A'}}><Plus size={12}/> Add</button>}>

      {/* Add form */}
      {adding && (
        <div style={{background:'#f8fafc',borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'8px',marginBottom:'8px'}}>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Name *</div><input style={inp} value={newLO.landowner_name} onChange={e=>setNewLO(f=>({...f,landowner_name:e.target.value}))} /></div>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Share %</div><input style={inp} type="number" value={newLO.share_pct} onChange={e=>setNewLO(f=>({...f,share_pct:e.target.value}))} /></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'10px'}}>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Bank (optional)</div><input style={inp} value={newLO.bank_name} onChange={e=>setNewLO(f=>({...f,bank_name:e.target.value}))} /></div>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Account No. (optional)</div><input style={inp} value={newLO.account_no} onChange={e=>setNewLO(f=>({...f,account_no:e.target.value}))} /></div>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>IFSC (optional)</div><input style={inp} value={newLO.ifsc_code} onChange={e=>setNewLO(f=>({...f,ifsc_code:e.target.value}))} /></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={() => addLO.mutate()} disabled={addLO.isPending} style={{padding:'6px 14px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>{addLO.isPending ? 'Saving…' : 'Save Landowner'}</button>
            <button onClick={() => setAdding(false)} style={{padding:'6px 14px',background:'white',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {!landowners?.length ? (
        <div style={{color:'#94a3b8',fontSize:'13px',padding:'8px 0'}}>No landowners added yet.</div>
      ) : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 70px 1fr 1fr 32px',gap:'8px',padding:'6px 0',borderBottom:'1px solid #f1f5f9',fontSize:'11px',fontWeight:600,color:'#64748b'}}>
            <span>Name</span><span>Share</span><span>Bank</span><span>Account / IFSC</span><span></span>
          </div>
          {landowners.map(lo => (
            <div key={lo.id} style={{display:'grid',gridTemplateColumns:'1fr 70px 1fr 1fr 32px',gap:'8px',padding:'10px 0',borderBottom:'1px solid #f8fafc',fontSize:'13px',alignItems:'center'}}>
              <span style={{fontWeight:500,color:'#1B2A4A'}}>{lo.landowner_name}</span>
              <span style={{color:'#1B2A4A'}}>{lo.share_pct}%</span>
              <span style={{color:'#64748b',fontSize:'12px'}}>{lo.bank_name || '—'}</span>
              <span style={{color:'#64748b',fontSize:'12px'}}>{lo.account_no ? `${lo.account_no} / ${lo.ifsc_code||'—'}` : '—'}</span>
              <button onClick={() => deleteLO(lo.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:0}}><Trash2 size={14}/></button>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:'13px',fontWeight:600}}>
            <span style={{color:'#64748b'}}>Total Allocated (of GLV Pool)</span>
            <span style={{color: totalShare > 100 ? '#ef4444' : (totalShare === 100 ? '#16a34a' : '#2F6FB0')}}>{totalShare.toFixed(2)}%</span>
          </div>
          <p style={{fontSize:'11px',color:'#94a3b8',margin:'0 0 10px'}}>Should total 100% — this is how the GLV amount is split across landowners. KSR's own share is calculated separately from the sale rate.</p>
        </>
      )}
    </Section>
  )
}

// ── Assigned Employees Section ─────────────────────────────────────────────
function AssignedEmployeesSection({ projectId, qc }) {
  const [adding, setAdding] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  const { data: assigned, refetch } = useQuery({
    queryKey: ['project-employees-assigned', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_employees')
        .select('id, employee_id, employees ( id, name, role )')
        .eq('project_id', projectId)
        .order('assigned_at')
      if (error) throw error
      return data
    },
  })

  const { data: allEmployees } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })

  const assignedIds = new Set((assigned || []).map(a => a.employee_id))
  const availableEmployees = (allEmployees || []).filter(e => !assignedIds.has(e.id))

  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedEmployeeId) throw new Error('Select an employee')
      const { error } = await supabase.from('project_employees').insert({
        project_id: projectId,
        employee_id: selectedEmployeeId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Employee assigned')
      refetch()
      setAdding(false)
      setSelectedEmployeeId('')
    },
    onError: (e) => toast.error(e.message),
  })

  const removeAssignment = async (id) => {
    if (!window.confirm('Remove this employee from the project?')) return
    const { error } = await supabase.from('project_employees').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Employee removed'); refetch() }
  }

  const roleLabel = (role) => ({
    sales_executive: 'Sales Executive',
    sales_manager: 'Sales Manager',
    presales: 'Presales',
    project_head: 'Project Head',
    md: 'MD',
    accounts: 'Accounts',
    admin: 'Admin',
  }[role] || role)

  return (
    <Section title="Assigned Employees"
      action={<button onClick={() => setAdding(a=>!a)} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'1px solid #b8cde8',borderRadius:'6px',background:'#EAF1FA',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#1B2A4A'}}><Plus size={12}/> Add</button>}>

      {adding && (
        <div style={{background:'#f8fafc',borderRadius:'8px',padding:'12px',marginBottom:'12px',display:'flex',gap:'8px',alignItems:'center'}}>
          <select style={inp} value={selectedEmployeeId} onChange={e=>setSelectedEmployeeId(e.target.value)}>
            <option value="">Select employee...</option>
            {availableEmployees.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({roleLabel(e.role)})</option>
            ))}
          </select>
          <button onClick={() => addAssignment.mutate()} disabled={addAssignment.isPending} style={{padding:'6px 14px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{addAssignment.isPending ? 'Saving…' : 'Assign'}</button>
          <button onClick={() => setAdding(false)} style={{padding:'6px 14px',background:'white',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Cancel</button>
        </div>
      )}

      {!assigned?.length ? (
        <div style={{color:'#94a3b8',fontSize:'13px',padding:'8px 0'}}>No employees assigned yet — this project's New Booking form will have no Assigned Executive options until you add some.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {assigned.map(a => (
            <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f8fafc',fontSize:'13px'}}>
              <span style={{fontWeight:500,color:'#1B2A4A'}}>{a.employees?.name}</span>
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{color:'#64748b',fontSize:'12px'}}>{roleLabel(a.employees?.role)}</span>
                <button onClick={() => removeAssignment(a.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:0}}><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Assigned Channel Partners Section ───────────────────────────────────────
function AssignedChannelPartnersSection({ projectId, qc }) {
  const [adding, setAdding] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState('')

  const { data: assigned, refetch } = useQuery({
    queryKey: ['project-channel-partners-assigned', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_channel_partners')
        .select('id, channel_partner_id, channel_partners ( id, name )')
        .eq('project_id', projectId)
        .order('assigned_at')
      if (error) throw error
      return data
    },
  })

  const { data: allPartners } = useQuery({
    queryKey: ['channel-partners-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_partners')
        .select('id, name')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })

  const assignedIds = new Set((assigned || []).map(a => a.channel_partner_id))
  const availablePartners = (allPartners || []).filter(p => !assignedIds.has(p.id))

  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedPartnerId) throw new Error('Select a channel partner')
      const { error } = await supabase.from('project_channel_partners').insert({
        project_id: projectId,
        channel_partner_id: selectedPartnerId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Channel partner assigned')
      refetch()
      setAdding(false)
      setSelectedPartnerId('')
    },
    onError: (e) => toast.error(e.message),
  })

  const removeAssignment = async (id) => {
    if (!window.confirm('Remove this channel partner from the project?')) return
    const { error } = await supabase.from('project_channel_partners').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Channel partner removed'); refetch() }
  }

  return (
    <Section title="Assigned Channel Partners"
      action={<button onClick={() => setAdding(a=>!a)} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'1px solid #b8cde8',borderRadius:'6px',background:'#EAF1FA',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#1B2A4A'}}><Plus size={12}/> Add</button>}>

      {adding && (
        <div style={{background:'#f8fafc',borderRadius:'8px',padding:'12px',marginBottom:'12px',display:'flex',gap:'8px',alignItems:'center'}}>
          <select style={inp} value={selectedPartnerId} onChange={e=>setSelectedPartnerId(e.target.value)}>
            <option value="">Select channel partner...</option>
            {availablePartners.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button onClick={() => addAssignment.mutate()} disabled={addAssignment.isPending} style={{padding:'6px 14px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{addAssignment.isPending ? 'Saving…' : 'Assign'}</button>
          <button onClick={() => setAdding(false)} style={{padding:'6px 14px',background:'white',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Cancel</button>
        </div>
      )}

      {!assigned?.length ? (
        <div style={{color:'#94a3b8',fontSize:'13px',padding:'8px 0'}}>No channel partners assigned yet — this project's New Booking form will have no Channel Partner options until you add some.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {assigned.map(a => (
            <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f8fafc',fontSize:'13px'}}>
              <span style={{fontWeight:500,color:'#1B2A4A'}}>{a.channel_partners?.name}</span>
              <button onClick={() => removeAssignment(a.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:0}}><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}



// ── PLC Section ────────────────────────────────────────────────────────────
function PLCSection({ proj, projectId, qc }) {
  const [adding, setAdding] = useState(false)
  const [newPLC, setNewPLC] = useState({ plc_name:'', amount_sqft:'' })

  const { data: plcs, refetch } = useQuery({
    queryKey: ['plcs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_plcs').select('*')
        .eq('project_id', projectId)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })

  const addPLC = useMutation({
    mutationFn: async () => {
      if (!newPLC.plc_name) throw new Error('PLC name is required')
      if (!newPLC.amount_sqft) throw new Error('Amount is required')
      const { error } = await supabase.from('project_plcs').insert({
        project_id: projectId,
        plc_name: newPLC.plc_name.trim(),
        amount_sqft: parseFloat(newPLC.amount_sqft),
        sort_order: (plcs?.length || 0) + 1,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('PLC added')
      refetch()
      setAdding(false)
      setNewPLC({ plc_name:'', amount_sqft:'' })
    },
    onError: (e) => toast.error(e.message),
  })

  const deletePLC = async (id, name) => {
    if (!window.confirm(`Delete PLC "${name}"?`)) return
    const { error } = await supabase.from('project_plcs').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('PLC deleted'); refetch() }
  }

  const toggleDisplay = async () => {
    const newMode = proj.plc_display_mode === 'included' ? 'separate' : 'included'
    const { error } = await supabase.from('projects')
      .update({ plc_display_mode: newMode }).eq('id', projectId)
    if (error) toast.error(error.message)
    else { toast.success('PLC display mode updated'); qc.invalidateQueries(['project', projectId]) }
  }

  const tinp = {padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}

  return (
    <Section title="PLC — Preferential Location Charges"
      action={
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          <button onClick={toggleDisplay} style={{padding:'4px 10px',border:'1px solid #e2e8f0',borderRadius:'6px',background:proj.plc_display_mode==='separate'?'#EAF1FA':'#f8fafc',fontSize:'11px',fontWeight:600,cursor:'pointer',color:'#1B2A4A'}}>
            {proj.plc_display_mode === 'separate' ? '📋 Shown Separately' : '📦 Included in Price'}
          </button>
          <button onClick={() => setAdding(a=>!a)} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'none',borderRadius:'6px',background:'#1B2A4A',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'white'}}>
            <Plus size={12}/> Add PLC
          </button>
        </div>
      }>

      <div style={{fontSize:'12px',color:'#64748b',marginBottom:'12px'}}>
        PLC is charged as extra ₹/Sq.ft on top of the base rate.
        {proj.plc_display_mode === 'separate'
          ? ' Currently shown separately in quotations.'
          : ' Currently included in the total price shown to customers.'}
      </div>

      {adding && (
        <div style={{background:'#f8fafc',borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 160px',gap:'10px',marginBottom:'10px'}}>
            <div>
              <div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>PLC Name *</div>
              <input style={{...tinp,width:'100%'}} value={newPLC.plc_name}
                onChange={e=>setNewPLC(f=>({...f,plc_name:e.target.value}))}
                placeholder="e.g. East Facing, North East Corner" />
            </div>
            <div>
              <div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Extra ₹ / Sq.ft *</div>
              <input style={{...tinp,width:'100%'}} type="number" value={newPLC.amount_sqft}
                onChange={e=>setNewPLC(f=>({...f,amount_sqft:e.target.value}))}
                placeholder="e.g. 100" />
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>addPLC.mutate()} disabled={addPLC.isPending}
              style={{padding:'6px 14px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
              {addPLC.isPending ? 'Saving…' : 'Save PLC'}
            </button>
            <button onClick={()=>setAdding(false)}
              style={{padding:'6px 14px',background:'white',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!plcs?.length ? (
        <div style={{color:'#94a3b8',fontSize:'13px',padding:'8px 0'}}>
          No PLCs defined. Add PLCs like "East Facing", "Corner Plot", "30ft Road Facing" etc.
        </div>
      ) : (
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#f8fafc'}}>
              {['PLC Name','Extra ₹/Sq.ft',''].map(h=>(
                <th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:'11px',fontWeight:600,color:'#64748b'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plcs.map(plc => (
              <tr key={plc.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                <td style={{padding:'10px'}}>{plc.plc_name}</td>
                <td style={{padding:'10px',fontWeight:600,color:'#1B2A4A'}}>+₹{plc.amount_sqft}/Sq.ft</td>
                <td style={{padding:'10px'}}>
                  <button onClick={()=>deletePLC(plc.id,plc.plc_name)}
                    style={{padding:'3px 8px',background:'white',color:'#ef4444',border:'1px solid #fecaca',borderRadius:'5px',fontSize:'11px',cursor:'pointer'}}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

// ── Plots Section ──────────────────────────────────────────────────────────
function PlotsSection({ proj, projectId }) {
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [newPlot, setNewPlot] = useState({ plot_number:'', area_sqft:'', facing:'', corner_plot:false, road_width_ft:'', base_price_sqft:'', rate_per_cent:'' })
  const [editForm, setEditForm] = useState({})
  const [importing, setImporting] = useState(false)

  const { data: plots, refetch, isLoading } = useQuery({
    queryKey: ['plots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plots').select('*, plot_plcs(id, amount_sqft, project_plcs(plc_name, amount_sqft))')
        .eq('project_id', projectId)
        .eq('plot_type', 'plot')
        .order('plot_number', { ascending: true })
        if (error) throw error
          return data.sort((a, b) => {
          const na = parseInt(a.plot_number) || 0
          const nb = parseInt(b.plot_number) || 0
        if (na !== nb) return na - nb
          return a.plot_number.localeCompare(b.plot_number)
})
      
      
    },
  })

  const { data: projectPLCs } = useQuery({
    queryKey: ['plcs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_plcs').select('*')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('sort_order')
        if (error) throw error
        return data
    },
  })

  const togglePlotPLC = async (plotId, plcId, currentPlotPLCs) => {
  const existing = currentPlotPLCs?.find(pp => {
    const plc = projectPLCs?.find(p => p.id === plcId)
    return pp.project_plcs?.plc_name === plc?.plc_name
  })
  if (existing) {
    const { error } = await supabase.from('plot_plcs').delete().eq('id', existing.id)
    if (error) { toast.error(error.message); return }
  } else {
    const { error } = await supabase.from('plot_plcs').insert({ plot_id: plotId, plc_id: plcId })
    if (error) { toast.error(error.message); return }
  }
  refetch()
  }

  const getPlotPLCTotal = (plot) => {
    if (!plot.plot_plcs?.length) return 0
    return plot.plot_plcs.reduce((sum, pp) => {
      const rate = pp.amount_sqft || pp.project_plcs?.amount_sqft || 0
      return sum + parseFloat(rate)
    }, 0)
  }

  const isCents = proj.unit_of_measure === 'cents'
  const CENTS_TO_SQFT = 435.6

  const calcTotalPrice = (area_sqft, base_price_sqft, rate_per_cent) => {
    if (!area_sqft) return null
    // For Cents-based projects, round the area to Cents at 2 decimals —
    // the exact same rounding used for the displayed "X.XX Cents" figure
    // — before multiplying. This keeps Total Price consistent with what's
    // actually shown on screen (matches a manual calculator check), even
    // though it's a hair less "precise" than using the raw unrounded area.
    if (isCents) {
      const cr = rate_per_cent != null ? parseFloat(rate_per_cent) : parseFloat(proj.sale_rate_per_cent)
      if (!cr) return null
      const areaCents = parseFloat((parseFloat(area_sqft) / CENTS_TO_SQFT).toFixed(2))
      return Math.round(areaCents * cr)
    }
    if (!base_price_sqft) return null
    return Math.round(parseFloat(area_sqft) * parseFloat(base_price_sqft))
  }

  const addPlot = useMutation({
    mutationFn: async () => {
      if (!newPlot.plot_number) throw new Error('Plot number is required')
      if (!newPlot.area_sqft) throw new Error('Area is required')
      const area = parseFloat(newPlot.area_sqft)

      let ratePerCent = null
      let basePriceSqft = null
      if (isCents) {
        ratePerCent = newPlot.rate_per_cent ? parseFloat(newPlot.rate_per_cent) : (proj.sale_rate_per_cent || null)
        // Derived reference only — never read back for editing, so no
        // precision loss accumulates from repeated round-trips.
        basePriceSqft = ratePerCent ? ratePerCent / CENTS_TO_SQFT : null
      } else {
        basePriceSqft = newPlot.base_price_sqft ? parseFloat(newPlot.base_price_sqft) : (proj.sale_rate_per_sqft || null)
      }
      const total = calcTotalPrice(area, basePriceSqft, ratePerCent)

      const { error } = await supabase.from('plots').insert({
        project_id: projectId,
        plot_number: newPlot.plot_number.trim(),
        area_sqft: area,
        facing: newPlot.facing || null,
        corner_plot: newPlot.corner_plot,
        road_width_ft: newPlot.road_width_ft ? parseFloat(newPlot.road_width_ft) : null,
        base_price_sqft: basePriceSqft,
        rate_per_cent: ratePerCent,
        total_price: total,
        plot_type: 'plot',
        status: 'available',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Plot added')
      refetch()
      setAdding(false)
      setNewPlot({ plot_number:'', area_sqft:'', facing:'', corner_plot:false, road_width_ft:'', base_price_sqft:'', rate_per_cent:'' })
    },
    onError: (e) => toast.error(e.message),
  })

  const savePlot = useMutation({
    mutationFn: async () => {
      const area = parseFloat(editForm.area_sqft)

      let ratePerCent = null
      let basePriceSqft = null
      if (isCents) {
        ratePerCent = editForm.rate_per_cent ? parseFloat(editForm.rate_per_cent) : null
        basePriceSqft = ratePerCent ? ratePerCent / CENTS_TO_SQFT : null
      } else {
        basePriceSqft = editForm.base_price_sqft ? parseFloat(editForm.base_price_sqft) : null
      }
      const total = calcTotalPrice(area, basePriceSqft, ratePerCent)

      const { error } = await supabase.from('plots').update({
        area_sqft: area,
        facing: editForm.facing || null,
        corner_plot: editForm.corner_plot,
        road_width_ft: editForm.road_width_ft ? parseFloat(editForm.road_width_ft) : null,
        base_price_sqft: basePriceSqft,
        rate_per_cent: ratePerCent,
        total_price: total,
      }).eq('id', editId)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Plot updated'); refetch(); setEditId(null) },
    onError: (e) => toast.error(e.message),
  })

  const deletePlot = async (id, plotNo) => {
    if (!window.confirm(`Delete plot ${plotNo}? This cannot be undone.`)) return
    const { error } = await supabase.from('plots').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Plot deleted'); refetch() }
  }

  const startEdit = (plot) => {
    setEditId(plot.id)
    setEditForm({
      area_sqft: plot.area_sqft || '',
      facing: plot.facing || '',
      corner_plot: plot.corner_plot || false,
      road_width_ft: plot.road_width_ft || '',
      base_price_sqft: plot.base_price_sqft || '',
      // Read the Cent rate directly from its own column — never converted
      // from base_price_sqft, so no precision is lost on repeated edits.
      rate_per_cent: plot.rate_per_cent || '',
    })
  }

  const handleCSV = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  setImporting(true)
  try {
    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''))
    
    // Parse all rows first
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g) || []
      const row = {}
      headers.forEach((h,idx) => { row[h] = (vals[idx]||'').replace(/^"|"$/g,'').trim() })
      if (row.plot_number) rows.push(row)
    }

    // Parse all points first to find global bounding box
    const allParsed = rows.map(row => {
      let pts = null
      try {
        const raw = row.points || ''
        const cleaned = raw.replace(/\(/g,'[').replace(/\)/g,']')
        pts = JSON.parse(cleaned)
      } catch {}
      return { row, pts }
    })

    // Weld nearby vertices across different plots so shared edges line up
    // exactly instead of leaving small gaps from imprecise drawing/extraction.
    // WELD_TOLERANCE is in raw coordinate units (same scale as rendered SVG
    // pixels, since coordinates are only translated, never scaled) — bump
    // this up if gaps are still visible after import, or down if distinct
    // corners are incorrectly merging together.
    const WELD_TOLERANCE = 8
    const allPts = []
    allParsed.forEach((r, plotIdx) => {
      if (!r.pts) return
      r.pts.forEach((p, ptIdx) => allPts.push({ plotIdx, ptIdx, x: p[0], y: p[1] }))
    })
    const weldedFlag = new Array(allPts.length).fill(false)
    for (let i = 0; i < allPts.length; i++) {
      if (weldedFlag[i]) continue
      const cluster = [i]
      for (let j = i + 1; j < allPts.length; j++) {
        if (weldedFlag[j]) continue
        const dx = allPts[i].x - allPts[j].x
        const dy = allPts[i].y - allPts[j].y
        if (Math.sqrt(dx*dx + dy*dy) <= WELD_TOLERANCE) cluster.push(j)
      }
      if (cluster.length > 1) {
        const avgX = cluster.reduce((s,idx)=>s+allPts[idx].x,0) / cluster.length
        const avgY = cluster.reduce((s,idx)=>s+allPts[idx].y,0) / cluster.length
        cluster.forEach(idx => {
          const { plotIdx, ptIdx } = allPts[idx]
          allParsed[plotIdx].pts[ptIdx] = [avgX, avgY]
          weldedFlag[idx] = true
        })
      } else {
        weldedFlag[i] = true
      }
    }

    // Global min X and Y across all plots
    const allX = allParsed.flatMap(r => r.pts ? r.pts.map(p => p[0]) : [])
    const allY = allParsed.flatMap(r => r.pts ? r.pts.map(p => p[1]) : [])
    const minX = allX.length ? Math.min(...allX) : 0
    const minY = allY.length ? Math.min(...allY) : 0
    const PAD = 20

    // Compute bg dimensions from global range
    const maxX = allX.length ? Math.max(...allX) : 1000
    const maxY = allY.length ? Math.max(...allY) : 600
    const bgWidth  = Math.round(maxX - minX) + PAD * 2
    const bgHeight = Math.round(maxY - minY) + PAD * 2

    // Area conversion factor — from raw units to sqft
    // Detect if area is in raw DXF units (large numbers) or already sqft
    const firstArea = parseFloat(rows[0]?.area || rows[0]?.area_sqft || 0)
    const FACTOR = firstArea > 10000 ? firstArea / 800 : 1  // assume first plot ~800 sqft if large

    let imported = 0, updated = 0, skipped = 0
    for (const { row, pts } of allParsed) {
      const plotNumber = row.plot_number

      // Check existing plot (from an earlier details-only or partial import)
      const { data: existing } = await supabase.from('plots')
        .select('id').eq('project_id', projectId).eq('plot_number', plotNumber).maybeSingle()

      // Normalize coordinates
      let polygonCoords = null
      if (pts) {
        polygonCoords = pts.map(p => [
          parseFloat((p[0] - minX + PAD).toFixed(2)),
          parseFloat((p[1] - minY + PAD).toFixed(2))
        ])
      }

      if (existing) {
        // Plot already exists — only useful if this CSV adds geometry it
        // didn't have before. If there's nothing new to add, skip it.
        if (!polygonCoords) { skipped++; continue }
        const { error } = await supabase.from('plots').update({
          polygon_coords: polygonCoords,
          bg_width:       bgWidth,
          bg_height:      bgHeight,
        }).eq('id', existing.id)
        if (!error) updated++; else { console.error(error); skipped++ }
        continue
      }

      // Area
      const rawArea = parseFloat(row.area || row.area_sqft || row.area_sq_units || 0)
      const areaSqft = rawArea > 10000 ? parseFloat((rawArea / FACTOR).toFixed(1)) : rawArea

      const basePriceSqft = proj.sale_rate_per_sqft || null
      const totalPrice = isCents && proj.sale_rate_per_cent && areaSqft
        ? Math.round(areaSqft * (proj.sale_rate_per_cent / CENTS_TO_SQFT))
        : (areaSqft && basePriceSqft ? Math.round(areaSqft * basePriceSqft) : null)

      // Optional plot_type column — 'plot', 'road', 'park', etc.
      // Defaults to 'plot' if the column is absent or blank.
      const plotType = (row.plot_type || row.type || 'plot').toLowerCase().trim()

      // Facing — normalise to title case
      const facingRaw = (row.facing || row.FACING || '').trim()
      const facing = facingRaw
        ? facingRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        : null

      const { error } = await supabase.from('plots').insert({
        project_id:     projectId,
        plot_number:    plotNumber,
        area_sqft:      areaSqft || null,
        plot_type:      plotType,
        status:         plotType === 'plot' ? 'available' : null,
        polygon_coords: polygonCoords,
        bg_width:       bgWidth,
        bg_height:      bgHeight,
        base_price_sqft: plotType === 'plot' ? basePriceSqft : null,
        rate_per_cent:  (plotType === 'plot' && isCents) ? (proj.sale_rate_per_cent || null) : null,
        total_price:    plotType === 'plot' ? totalPrice : null,
        facing:         facing,
      })
      if (!error) imported++; else { console.error(error); skipped++ }
    }
    toast.success(
      `Imported ${imported}${updated ? `, updated ${updated}` : ''} plots${skipped ? `, ${skipped} skipped` : ''}`
    )
    refetch()
  } catch(err) {
    toast.error('Import failed: ' + err.message)
    console.error(err)
  }
  setImporting(false)
  e.target.value = ''
}

  const fmt = (n) => n ? '₹' + Math.round(n).toLocaleString('en-IN') : '—'
  const fmtArea = (a) => {
    if (!a) return '—'
    if (isCents) return `${(a/CENTS_TO_SQFT).toFixed(2)} Cents (${Math.round(a)} Sq.ft)`
    return `${Math.round(a)} Sq.ft`
  }

  const tinp = {padding:'5px 8px',border:'1px solid #d1d5db',borderRadius:'5px',fontSize:'12px',width:'100%',boxSizing:'border-box'}

  return (
    <Section title={`Plots (${plots?.length || 0})`}
      action={
        <div style={{display:'flex',gap:'6px'}}>
          <label style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'1px solid #b8cde8',borderRadius:'6px',background:'#EAF1FA',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#1B2A4A'}}>
            {importing ? 'Importing…' : '⬆ Import CSV'}
            <input type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}} />
          </label>
          <button onClick={() => setAdding(a=>!a)} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',border:'none',borderRadius:'6px',background:'#1B2A4A',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'white'}}>
            <Plus size={12}/> Add Plot
          </button>
        </div>
      }>

      {/* Add Plot Form */}
      {adding && (
        <div style={{background:'#f8fafc',borderRadius:'8px',padding:'14px',marginBottom:'14px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'#1B2A4A',marginBottom:'10px'}}>New Plot</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'8px',marginBottom:'10px'}}>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Plot No. *</div><input style={tinp} value={newPlot.plot_number} onChange={e=>setNewPlot(f=>({...f,plot_number:e.target.value}))} placeholder="e.g. 1" /></div>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Area (Sq.ft) *</div><input style={tinp} type="number" value={newPlot.area_sqft} onChange={e=>setNewPlot(f=>({...f,area_sqft:e.target.value}))} /></div>
            <div>
              <div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Facing</div>
              <select style={{...tinp,background:'white'}} value={newPlot.facing} onChange={e=>setNewPlot(f=>({...f,facing:e.target.value}))}>
                <option value="">—</option>
                <option>East</option><option>West</option><option>North</option><option>South</option>
                <option>North East</option><option>North West</option><option>South East</option><option>South West</option>
              </select>
            </div>
            <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Road Width (ft)</div><input style={tinp} type="number" value={newPlot.road_width_ft} onChange={e=>setNewPlot(f=>({...f,road_width_ft:e.target.value}))} /></div>
            <div>
              <div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>{isCents ? 'Rate/Cent' : 'Base Price/Sq.ft'}</div>
              <input style={tinp} type="number" value={isCents ? newPlot.rate_per_cent : newPlot.base_price_sqft} onChange={e=>setNewPlot(f=>(isCents ? {...f,rate_per_cent:e.target.value} : {...f,base_price_sqft:e.target.value}))} placeholder={(isCents ? proj.sale_rate_per_cent : proj.sale_rate_per_sqft) || ''} />
            </div>
            <div style={{display:'flex',alignItems:'flex-end',paddingBottom:'2px',gap:'6px'}}>
              <input type="checkbox" checked={newPlot.corner_plot} onChange={e=>setNewPlot(f=>({...f,corner_plot:e.target.checked}))} style={{width:'14px',height:'14px'}} />
              <span style={{fontSize:'12px',color:'#374151'}}>Corner</span>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>addPlot.mutate()} disabled={addPlot.isPending} style={{padding:'6px 14px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>{addPlot.isPending?'Saving…':'Save Plot'}</button>
            <button onClick={()=>setAdding(false)} style={{padding:'6px 14px',background:'white',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{color:'#94a3b8',padding:'20px',textAlign:'center'}}>Loading plots...</div>
      ) : !plots?.length ? (
        <div style={{color:'#94a3b8',padding:'20px',textAlign:'center'}}>
          No plots yet. Add manually or import from CSV.
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['Plot No','Area','Facing','Road Width','Base Price','PLC','Total Price','Corner','Status',''].map(h=>(
                  <th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:'11px',fontWeight:600,color:'#64748b',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plots.map(p => (
                <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                  {editId === p.id ? (
                    <>
                      <td style={{padding:'8px 10px',fontWeight:600,color:'#1B2A4A'}}>{p.plot_number}</td>
                      <td style={{padding:'8px 6px'}}><input style={{...tinp,width:'90px'}} type="number" value={editForm.area_sqft} onChange={e=>setEditForm(f=>({...f,area_sqft:e.target.value}))} /></td>
                      <td style={{padding:'8px 6px'}}>
                        <select style={{...tinp,width:'100px',background:'white'}} value={editForm.facing} onChange={e=>setEditForm(f=>({...f,facing:e.target.value}))}>
                          <option value="">—</option>
                          <option>East</option><option>West</option><option>North</option><option>South</option>
                          <option>North East</option><option>North West</option><option>South East</option><option>South West</option>
                        </select>
                      </td>
                      <td style={{padding:'8px 6px'}}><input style={{...tinp,width:'70px'}} type="number" value={editForm.road_width_ft} onChange={e=>setEditForm(f=>({...f,road_width_ft:e.target.value}))} /></td>
                      <td style={{padding:'8px 6px'}}><input style={{...tinp,width:'90px'}} type="number" title={isCents ? 'Rate/Cent' : 'Base Price/Sq.ft'} value={isCents ? editForm.rate_per_cent : editForm.base_price_sqft} onChange={e=>setEditForm(f=>(isCents ? {...f,rate_per_cent:e.target.value} : {...f,base_price_sqft:e.target.value}))} /></td>
                      <td style={{padding:'8px 6px',textAlign:'center'}}><input type="checkbox" checked={editForm.corner_plot} onChange={e=>setEditForm(f=>({...f,corner_plot:e.target.checked}))} /></td>
                      <td style={{padding:'8px 6px'}}>
                        <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:'#dcfce7',color:'#166534'}}>{p.status}</span>
                      </td>
                      <td style={{padding:'8px 6px',whiteSpace:'nowrap'}}>
                        <button onClick={()=>savePlot.mutate()} style={{padding:'3px 8px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'5px',fontSize:'11px',cursor:'pointer',marginRight:'4px'}}>Save</button>
                        <button onClick={()=>setEditId(null)} style={{padding:'3px 8px',background:'white',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:'5px',fontSize:'11px',cursor:'pointer'}}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{padding:'8px 10px',fontWeight:600,color:'#1B2A4A'}}>{p.plot_number}</td>
                      <td style={{padding:'8px 10px',color:'#374151'}}>{fmtArea(p.area_sqft)}</td>
                      <td style={{padding:'8px 10px',color:'#64748b'}}>{p.facing || '—'}</td>
                      <td style={{padding:'8px 10px',color:'#64748b'}}>{p.road_width_ft ? `${p.road_width_ft} ft` : '—'}</td>
                      <td style={{padding:'8px 10px',color:'#374151'}}>{isCents ? `${fmt(p.rate_per_cent)}/Cent` : `${fmt(p.base_price_sqft)}/sqft`}</td>
                      <td style={{padding:'8px 10px'}}>
                        {projectPLCs?.length > 0 && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:'3px'}}>
                            {projectPLCs.map(plc => {
                              const applied = p.plot_plcs?.find(pp => pp.project_plcs?.plc_name === plc.plc_name)
                              return (
                                <button key={plc.id}
                                  onClick={() => togglePlotPLC(p.id, plc.id, p.plot_plcs)}
                                  title={`+₹${plc.amount_sqft}/sqft`}
                                  style={{padding:'2px 6px',border:'1px solid',borderRadius:'4px',fontSize:'10px',cursor:'pointer',fontWeight:600,
                                    background: applied ? '#1B2A4A' : 'white',
                                    color: applied ? 'white' : '#64748b',
                                    borderColor: applied ? '#1B2A4A' : '#e2e8f0'
                                  }}>
                                  {plc.plc_name}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {!projectPLCs?.length && <span style={{color:'#94a3b8',fontSize:'12px'}}>—</span>}
                      </td>
                      <td style={{padding:'8px 10px',color:'#374151',fontWeight:600}}>
                        {(() => {
                          if (!p.area_sqft) return fmt(p.total_price)
                          const plcAmount = p.area_sqft * getPlotPLCTotal(p)
                          if (isCents) {
                            const cr = p.rate_per_cent || proj.sale_rate_per_cent
                            if (!cr) return fmt(p.total_price)
                            const areaCents = parseFloat((p.area_sqft / CENTS_TO_SQFT).toFixed(2))
                            return fmt(Math.round(areaCents * cr) + Math.round(plcAmount))
                          }
                          if (!p.base_price_sqft) return fmt(p.total_price)
                          return fmt(Math.round(p.area_sqft * parseFloat(p.base_price_sqft) + plcAmount))
                        })()}
                      </td>
                      <td style={{padding:'8px 10px',textAlign:'center'}}>{p.corner_plot ? '✅' : '—'}</td>
                      <td style={{padding:'8px 10px'}}>
                        <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,
                          background: p.status==='available'?'#dcfce7':p.status==='booked'?'#dbeafe':p.status==='registered'?'#1B2A4A22':'#fef3c7',
                          color: p.status==='available'?'#166534':p.status==='booked'?'#1e40af':p.status==='registered'?'#1B2A4A':'#92400e'
                        }}>{p.status}</span>
                      </td>
                      <td style={{padding:'8px 6px',whiteSpace:'nowrap'}}>
                        <button onClick={()=>startEdit(p)} style={{padding:'3px 8px',background:'white',color:'#1B2A4A',border:'1px solid #e2e8f0',borderRadius:'5px',fontSize:'11px',cursor:'pointer',marginRight:'4px'}}>Edit</button>
                        <button onClick={()=>deletePlot(p.id,p.plot_number)} style={{padding:'3px 8px',background:'white',color:'#ef4444',border:'1px solid #fecaca',borderRadius:'5px',fontSize:'11px',cursor:'pointer'}}>Del</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
// ── Documents Panel (collapsible) ─────────────────────────────────
function DocumentsPanelCollapsible({ projectId }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div style={{background:'white',borderRadius:'10px',border:'1px solid #e2e8f0',marginBottom:'16px'}}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'14px 20px',background:'none',border:'none',cursor:'pointer',
        }}
      >
        <div style={{fontSize:'14px',fontWeight:700,color:'#1B2A4A'}}>Documents</div>
        <span style={{fontSize:'12px',color:'#64748b',fontWeight:500}}>
          {open ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>
      {open && (
        <div style={{borderTop:'1px solid #f1f5f9'}}>
          <DocumentsPanel projectId={projectId} />
        </div>
      )}
    </div>
  )
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = new URLSearchParams(location.search).get('returnTo')
  const qc = useQueryClient()

  const { data: proj, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
      if (error) throw error
      return data
    },
  })

  const { data: plotStats } = useQuery({
    queryKey: ['plot-stats', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('plots').select('status,plot_type').eq('project_id', projectId).eq('plot_type', 'plot')
      if (error) throw error
      const c = { available:0, blocked:0, booked:0, registered:0 }
      data.forEach(p => { if (c[p.status] !== undefined) c[p.status]++ })
      return { total: data.length, ...c }
    },
  })

  // Must match ksr.projects_status_check constraint values
  const STATUS_STYLES = {
    active:      { background:'#dcfce7', color:'#166534' },
    on_hold:     { background:'#fef3c7', color:'#92400e' },
    completed:   { background:'#dbeafe', color:'#1e40af' },
  }
  const STATUS_LABELS = {
    active: 'Active', on_hold: 'On Hold', completed: 'Completed',
  }

  const changeStatus = useMutation({
    mutationFn: async (newStatus) => {
      const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries(['project', projectId]) },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <div style={{padding:'40px',textAlign:'center',color:'#94a3b8'}}>Loading...</div>
  if (!proj) return <div style={{padding:'40px',textAlign:'center',color:'#ef4444'}}>Project not found.</div>

  return (
    <div style={{padding:'24px',fontFamily:'Segoe UI,sans-serif',maxWidth:'900px'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
        <button
            onClick={() => navigate(returnTo || '/projects')}
            style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',display:'flex',padding:0}}
          >
            <ArrowLeft size={18}/>
          </button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
            <h1 style={{fontSize:'20px',fontWeight:700,color:'#1B2A4A',margin:0}}>{proj.name}</h1>
            {proj.is_jv && <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:'#fef3c7',color:'#92400e'}}>JV</span>}
            <select
              value={proj.status}
              onChange={e => changeStatus.mutate(e.target.value)}
              disabled={changeStatus.isPending}
              style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,border:'none',cursor:'pointer',...(STATUS_STYLES[proj.status]||STATUS_STYLES.active)}}
            >
              {Object.keys(STATUS_LABELS).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div style={{fontSize:'13px',color:'#64748b',marginTop:'2px'}}>
            {[proj.region, proj.location, proj.taluk, proj.district].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Link to={`/projects/${projectId}/inventory`}>
          <button style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'#1B2A4A',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
            <Map size={14}/> View Inventory
          </button>
        </Link>
      </div>

      {/* Stats */}
      {plotStats && (
        <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
          {[['Total',plotStats.total],['Available',plotStats.available],['Blocked',plotStats.blocked],['Booked',plotStats.booked],['Registered',plotStats.registered]].map(([l,v])=>(
            <div key={l} style={{background:'white',borderRadius:'8px',padding:'10px 16px',textAlign:'center',border:'1px solid #e2e8f0',flex:1,minWidth:'80px'}}>
              <div style={{fontSize:'20px',fontWeight:700,color:'#1B2A4A'}}>{v}</div>
              <div style={{fontSize:'11px',color:'#64748b',marginTop:'2px'}}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <DetailsSection proj={proj} projectId={projectId} qc={qc} />
      <RatesSection   proj={proj} projectId={projectId} qc={qc} />
      <AssignedEmployeesSection projectId={projectId} qc={qc} />
      <AssignedChannelPartnersSection projectId={projectId} qc={qc} />
      <DocumentsPanelCollapsible projectId={projectId} />
      <LandownersSection proj={proj} projectId={projectId} qc={qc} />
      <PLCSection proj={proj} projectId={projectId} qc={qc} />
      <PlotsSection proj={proj} projectId={projectId} />
    </div>
  )
}
