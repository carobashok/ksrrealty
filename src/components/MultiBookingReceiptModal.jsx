// src/components/MultiBookingReceiptModal.jsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { X, Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

const MODES = ['cash','cheque','neft','rtgs','upi','dd','imps']
const inr = (n) => '₹' + Number(n||0).toLocaleString('en-IN')

// One split line inside a plot section
function SplitLine({ line, onChange, onRemove, landowners, isJv }) {
  const typeOptions = [
    { value: 'company_share', label: 'Company (KSR)' },
    ...(isJv ? landowners.map(lo => ({ value: lo.id, label: lo.landowner_name })) : []),
  ]

  return (
    <div style={{display:'grid',gridTemplateColumns:'160px 130px 1fr 28px',gap:'6px',alignItems:'center'}}>
      {/* Type */}
      <select
        value={line.type_key}
        onChange={e => onChange({ ...line, type_key: e.target.value })}
        style={{padding:'5px 8px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'12px',background:'white'}}
      >
        {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {/* Amount */}
      <input
        type="number"
        value={line.amount}
        onChange={e => onChange({ ...line, amount: e.target.value })}
        placeholder="Amount ₹"
        style={{padding:'5px 8px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'12px',fontWeight:600}}
      />
      {/* Remarks */}
      <input
        value={line.remarks}
        onChange={e => onChange({ ...line, remarks: e.target.value })}
        placeholder="Remarks (e.g. Advance, 2nd instalment...)"
        style={{padding:'5px 8px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'12px'}}
      />
      {/* Remove */}
      <button onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:0,display:'flex',alignItems:'center'}}>
        <Trash2 size={13}/>
      </button>
    </div>
  )
}

// One collapsible plot section
function PlotSection({ booking, landowners, checked, onToggle, lines, onLinesChange }) {
  const [open, setOpen] = useState(true)
  const isJv = landowners.length > 0
  const plotTotal = lines.reduce((s,l) => s + (parseFloat(l.amount)||0), 0)

  const addLine = () => {
    onLinesChange([...lines, { id: Date.now(), type_key: 'company_share', amount: '', remarks: '' }])
  }

  const updateLine = (id, updated) => {
    onLinesChange(lines.map(l => l.id === id ? updated : l))
  }

  const removeLine = (id) => {
    onLinesChange(lines.filter(l => l.id !== id))
  }

  const plotLabel = booking.plots?.plot_number
    ? `Plot ${booking.plots.plot_number}${booking.plots.block ? ` (${booking.plots.block})` : ''}`
    : 'Plot —'

  return (
    <div style={{
      border: `1px solid ${checked ? '#1B2A4A' : '#e2e8f0'}`,
      borderRadius:'8px',
      overflow:'hidden',
      opacity: checked ? 1 : 0.5,
    }}>
      {/* Header */}
      <div style={{
        display:'flex',alignItems:'center',gap:'10px',
        padding:'10px 12px',
        background: checked ? '#f8fafc' : '#f1f5f9',
        cursor:'pointer',
      }}>
        {/* Checkbox */}
        <input type="checkbox" checked={checked} onChange={onToggle}
          style={{width:'15px',height:'15px',cursor:'pointer',flexShrink:0}}
          onClick={e => e.stopPropagation()}
        />
        {/* Plot info */}
        <div style={{flex:1}} onClick={() => checked && setOpen(o=>!o)}>
          <span style={{fontWeight:700,color:'#1B2A4A',fontSize:'13px'}}>{plotLabel}</span>
          <span style={{color:'#64748b',fontSize:'12px',marginLeft:'8px'}}>{booking.projects?.name}</span>
          {isJv && <span style={{marginLeft:'6px',fontSize:'10px',padding:'1px 5px',borderRadius:'10px',background:'#fef3c7',color:'#92400e',fontWeight:600}}>JV</span>}
        </div>
        {/* Plot total + chevron */}
        {checked && (
          <>
            <span style={{fontSize:'12px',color: plotTotal>0 ? '#1B2A4A' : '#94a3b8',fontWeight:600}}>
              {plotTotal > 0 ? inr(plotTotal) : '—'}
            </span>
            <span onClick={() => setOpen(o=>!o)} style={{cursor:'pointer',color:'#94a3b8'}}>
              {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </span>
          </>
        )}
        {!checked && (
          <span style={{fontSize:'11px',color:'#94a3b8'}}>excluded</span>
        )}
      </div>

      {/* Lines */}
      {checked && open && (
        <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:'6px',background:'white'}}>
          {/* Column headers */}
          {lines.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'160px 130px 1fr 28px',gap:'6px',marginBottom:'2px'}}>
              <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:600}}>TYPE</div>
              <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:600}}>AMOUNT</div>
              <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:600}}>REMARKS</div>
              <div/>
            </div>
          )}
          {lines.map(l => (
            <SplitLine
              key={l.id}
              line={l}
              landowners={landowners}
              isJv={isJv}
              onChange={updated => updateLine(l.id, updated)}
              onRemove={() => removeLine(l.id)}
            />
          ))}
          <button onClick={addLine} style={{
            display:'flex',alignItems:'center',gap:'4px',
            padding:'4px 0',background:'none',border:'none',
            cursor:'pointer',color:'#1B2A4A',fontSize:'12px',fontWeight:600,
            alignSelf:'flex-start'
          }}>
            <Plus size={12}/> Add line
          </button>
        </div>
      )}
    </div>
  )
}

export default function MultiBookingReceiptModal({ customerId, customerName, onClose, onSaved }) {
  const qc = useQueryClient()

  const [date, setDate]       = useState(new Date().toISOString().slice(0,10))
  const [mode, setMode]       = useState('cash')
  const [refNo, setRefNo]     = useState('')
  const [totalAmount, setTotal] = useState('')
  const [saving, setSaving]   = useState(false)

  // checked: which bookings are included
  const [checked, setChecked] = useState({})
  // lines: { [bookingId]: [{id, type_key, amount, remarks}] }
  const [lines, setLines]     = useState({})

  // Load all active bookings for this customer — separate queries to avoid schema join issues
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['customer-active-bookings', customerId],
    queryFn: async () => {
      // 1. Fetch bookings
      const { data: bData, error: bErr } = await supabase
        .schema('ksr')
        .from('bookings')
        .select('id, booking_date, project_id, plot_id')
        .eq('customer_id', customerId)
        .in('status', ['booked','registered'])
        .order('booking_date')
      if (bErr) throw bErr
      if (!bData.length) return []

      // 2. Fetch plots for these bookings
      const plotIds = bData.map(b => b.plot_id).filter(Boolean)
      const { data: plotData } = await supabase
        .schema('ksr')
        .from('plots')
        .select('id, plot_number, block, total_price')
        .in('id', plotIds)
      const plotMap = Object.fromEntries((plotData||[]).map(p => [p.id, p]))

      // 3. Fetch projects
      const projIds = [...new Set(bData.map(b => b.project_id).filter(Boolean))]
      const { data: projData } = await supabase
        .schema('ksr')
        .from('projects')
        .select('id, name, is_jv')
        .in('id', projIds)
      const projMap = Object.fromEntries((projData||[]).map(p => [p.id, p]))

      // 4. Merge
      const merged = bData.map(b => ({
        ...b,
        plots:    plotMap[b.plot_id] || null,
        projects: projMap[b.project_id] || null,
        total_price: plotMap[b.plot_id]?.total_price || null,
      }))

      // Init checked and lines
      const c = {}, l = {}
      merged.forEach(b => {
        c[b.id] = true
        l[b.id] = [{ id: Date.now() + Math.random(), type_key: 'company_share', amount: '', remarks: '' }]
      })
      setChecked(c)
      setLines(l)
      return merged
    },
  })

  // Load landowners for each unique project
  const projectIds = [...new Set(bookings.map(b => b.project_id).filter(Boolean))]
  const { data: allLandowners = [] } = useQuery({
    queryKey: ['landowners-for-projects', projectIds.join(',')],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('project_landowners')
        .select('id, landowner_name, project_id')
        .in('project_id', projectIds)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })

  const getLandowners = (projectId) => allLandowners.filter(lo => lo.project_id === projectId)

  // Totals
  const totalAllocated = bookings
    .filter(b => checked[b.id])
    .flatMap(b => lines[b.id] || [])
    .reduce((s, l) => s + (parseFloat(l.amount)||0), 0)

  const totalAmt  = parseFloat(totalAmount) || 0
  const diff      = totalAmt - totalAllocated
  const balanced  = totalAmt > 0 && Math.abs(diff) < 0.01

  const toggleBooking = (bookingId) => {
    setChecked(prev => ({ ...prev, [bookingId]: !prev[bookingId] }))
  }

  const handleSave = async () => {
    if (!totalAmt || totalAmt <= 0) { toast.error('Enter total amount received'); return }
    if (!balanced) { toast.error('Split amounts must equal total'); return }

    const activeSplitLines = bookings
      .filter(b => checked[b.id])
      .flatMap(b => (lines[b.id]||[])
        .filter(l => parseFloat(l.amount) > 0)
        .map(l => ({
          booking_id:   b.id,
          payment_type: l.type_key === 'company_share' ? 'company_share' : 'landowner_share',
          landowner_id: l.type_key === 'company_share' ? null : l.type_key,
          amount:       parseFloat(l.amount),
          remarks:      l.remarks || null,
        }))
      )

    if (!activeSplitLines.length) { toast.error('Enter at least one amount'); return }

    setSaving(true)
    try {
      // Insert payment row
      const { data: payment, error: payErr } = await supabase
        .schema('ksr')
        .from('payments')
        .insert({
          booking_id:   null,
          is_split:     true,
          payment_type: 'company_share', // header level — detail in splits
          paid_by:      'plot_purchaser',
          payment_date: date,
          amount:       totalAmt,
          mode:         mode,
          reference_no: refNo || null,
        })
        .select('id')
        .single()
      if (payErr) throw payErr

      // Insert split rows
      const splitRows = activeSplitLines.map(l => ({
        payment_id:   payment.id,
        booking_id:   l.booking_id,
        payment_type: l.payment_type,
        landowner_id: l.landowner_id,
        amount:       l.amount,
        remarks:      l.remarks,
      }))

      const { error: splitErr } = await supabase
        .schema('ksr')
        .from('booking_payment_splits')
        .insert(splitRows)
      if (splitErr) throw splitErr

      toast.success('Receipt saved')
      qc.invalidateQueries(['all-receipts'])
      bookings.filter(b => checked[b.id]).forEach(b => {
        qc.invalidateQueries(['booking-splits', b.id])
      })
      onSaved?.()
      onClose()
    } catch(e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'16px'
    }}>
      <div style={{
        background:'white',borderRadius:'12px',padding:'24px',
        width:'100%',maxWidth:'680px',maxHeight:'92vh',overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:700,color:'#1B2A4A'}}>Multi-plot Receipt</div>
            <div style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>{customerName}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8'}}>
            <X size={20}/>
          </button>
        </div>

        {/* Payment header fields */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'16px'}}>
          <div>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>DATE *</div>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>MODE *</div>
            <select value={mode} onChange={e=>setMode(e.target.value)}
              style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',background:'white',boxSizing:'border-box'}}>
              {MODES.map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>REFERENCE NO.</div>
            <input value={refNo} onChange={e=>setRefNo(e.target.value)} placeholder="UTR / Cheque no."
              style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
        </div>

        {/* Total amount */}
        <div style={{background:'#f8fafc',borderRadius:'8px',padding:'12px 14px',marginBottom:'16px'}}>
          <div style={{fontSize:'11px',color:'#64748b',marginBottom:'6px',fontWeight:600}}>TOTAL AMOUNT RECEIVED (₹)</div>
          <input
            type="number" value={totalAmount} onChange={e=>setTotal(e.target.value)}
            placeholder="0"
            style={{width:'100%',padding:'10px 12px',border:'2px solid #1B2A4A',borderRadius:'8px',fontSize:'20px',fontWeight:700,color:'#1B2A4A',boxSizing:'border-box'}}
          />
        </div>

        {/* Plot sections */}
        <div style={{fontSize:'11px',fontWeight:700,color:'#1B2A4A',marginBottom:'8px',letterSpacing:'0.05em'}}>
          ALLOCATE ACROSS PLOTS
        </div>

        {isLoading ? (
          <div style={{color:'#94a3b8',padding:'20px',textAlign:'center',fontSize:'13px'}}>Loading bookings...</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
            {bookings.map(b => (
              <PlotSection
                key={b.id}
                booking={b}
                landowners={getLandowners(b.project_id)}
                checked={!!checked[b.id]}
                onToggle={() => toggleBooking(b.id)}
                lines={lines[b.id] || []}
                onLinesChange={newLines => setLines(prev => ({ ...prev, [b.id]: newLines }))}
              />
            ))}
          </div>
        )}

        {/* Balance indicator */}
        {totalAmt > 0 && (
          <div style={{
            display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',
            borderRadius:'8px',marginBottom:'16px',
            background: balanced ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${balanced ? '#bbf7d0' : '#fecaca'}`
          }}>
            {balanced
              ? <CheckCircle2 size={16} color="#16a34a"/>
              : <AlertCircle size={16} color="#ef4444"/>
            }
            <div style={{fontSize:'13px',flex:1}}>
              <span style={{fontWeight:600,color: balanced?'#16a34a':'#ef4444'}}>
                {balanced
                  ? 'Balanced'
                  : `${diff > 0 ? 'Under-allocated' : 'Over-allocated'} by ${inr(Math.abs(diff))}`
                }
              </span>
              <span style={{color:'#64748b',marginLeft:'8px',fontSize:'12px'}}>
                Allocated {inr(totalAllocated)} of {inr(totalAmt)}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
          <button onClick={onClose}
            style={{padding:'8px 18px',background:'white',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:'7px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !balanced}
            style={{
              padding:'8px 20px',
              background: balanced ? '#1B2A4A' : '#94a3b8',
              color:'white',border:'none',borderRadius:'7px',
              fontSize:'13px',fontWeight:600,
              cursor: balanced ? 'pointer' : 'not-allowed'
            }}>
            {saving ? 'Saving...' : 'Save Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
