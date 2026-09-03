// src/components/MultiBookingReceiptModal.jsx
// Records one receipt split manually across multiple bookings of the same customer

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { X, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

const MODES = ['cash','cheque','neft','rtgs','upi','dd','imps']
const inr = (n) => '₹' + Number(n||0).toLocaleString('en-IN')

export default function MultiBookingReceiptModal({ customerId, customerName, onClose, onSaved }) {
  const qc = useQueryClient()

  const [date, setDate]         = useState(new Date().toISOString().slice(0,10))
  const [mode, setMode]         = useState('cash')
  const [refNo, setRefNo]       = useState('')
  const [totalAmount, setTotal] = useState('')
  const [splits, setSplits]     = useState({})   // bookingId → { amount, remarks }
  const [saving, setSaving]     = useState(false)

  // Load all active bookings for this customer
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['customer-active-bookings', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select(`
          id, booking_date, total_price,
          plots ( plot_number, block ),
          projects ( name )
        `)
        .eq('customer_id', customerId)
        .in('status', ['booked', 'registered'])
        .order('booking_date')
      if (error) throw error
      return data
    },
  })

  // Initialise split rows when bookings load
  const initSplits = (bks) => {
    const s = {}
    bks.forEach(b => { s[b.id] = { amount: '', remarks: '' } })
    setSplits(s)
  }
  if (bookings.length && !Object.keys(splits).length) initSplits(bookings)

  const setSplit = (bookingId, field, value) => {
    setSplits(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], [field]: value } }))
  }

  const totalSplit = Object.values(splits).reduce((s, v) => s + (parseFloat(v.amount)||0), 0)
  const totalAmt   = parseFloat(totalAmount) || 0
  const diff       = totalAmt - totalSplit
  const balanced   = totalAmt > 0 && Math.abs(diff) < 0.01

  const handleSave = async () => {
    if (!totalAmt || totalAmt <= 0) { toast.error('Enter total amount'); return }
    if (!balanced) { toast.error('Split amounts must equal total'); return }

    const activeSplits = Object.entries(splits).filter(([, v]) => parseFloat(v.amount) > 0)
    if (!activeSplits.length) { toast.error('Enter amount for at least one plot'); return }

    setSaving(true)
    try {
      // 1. Get next receipt number
      const { data: seqData, error: seqErr } = await supabase
        .schema('ksr')
        .rpc('nextval', { seq: 'ksr.receipt_no_seq' })
      // Fallback: use timestamp if RPC not available
      const receiptNo = seqData ? `REC-${seqData}` : `REC-${Date.now()}`

      // 2. Insert one payment row (booking_id null, is_split true)
      const { data: payment, error: payErr } = await supabase
        .schema('ksr')
        .from('payments')
        .insert({
          booking_id:   null,
          is_split:     true,
          payment_type: 'company_share',
          paid_by:      'plot_purchaser',
          payment_date: date,
          amount:       totalAmt,
          mode:         mode,
          reference_no: refNo || null,
          receipt_no:   receiptNo,
        })
        .select('id')
        .single()
      if (payErr) throw payErr

      // 3. Insert split rows
      const splitRows = activeSplits.map(([bookingId, v]) => ({
        payment_id: payment.id,
        booking_id: bookingId,
        amount:     parseFloat(v.amount),
        remarks:    v.remarks || null,
      }))
      const { error: splitErr } = await supabase
        .schema('ksr')
        .from('booking_payment_splits')
        .insert(splitRows)
      if (splitErr) throw splitErr

      toast.success('Receipt saved')
      qc.invalidateQueries(['all-receipts'])
      qc.invalidateQueries(['customer-active-bookings', customerId])
      // Invalidate each booking's payment ledger
      activeSplits.forEach(([bookingId]) => {
        qc.invalidateQueries(['payments', bookingId])
        qc.invalidateQueries(['booking-splits', bookingId])
      })
      onSaved?.()
      onClose()
    } catch (e) {
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
        width:'100%',maxWidth:'640px',maxHeight:'90vh',overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:700,color:'#1B2A4A'}}>Record Receipt</div>
            <div style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>{customerName}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8'}}>
            <X size={20}/>
          </button>
        </div>

        {/* Payment details */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginBottom:'20px'}}>
          <div>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>Date *</div>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>Mode *</div>
            <select value={mode} onChange={e=>setMode(e.target.value)}
              style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',background:'white',boxSizing:'border-box'}}>
              {MODES.map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>Reference No.</div>
            <input value={refNo} onChange={e=>setRefNo(e.target.value)} placeholder="UTR / Cheque no."
              style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
        </div>

        {/* Total amount */}
        <div style={{background:'#f8fafc',borderRadius:'8px',padding:'14px',marginBottom:'20px'}}>
          <div style={{fontSize:'12px',color:'#64748b',marginBottom:'6px',fontWeight:600}}>Total Amount Received (₹)</div>
          <input
            type="number"
            value={totalAmount}
            onChange={e=>setTotal(e.target.value)}
            placeholder="0"
            style={{width:'100%',padding:'10px 12px',border:'2px solid #1B2A4A',borderRadius:'8px',fontSize:'18px',fontWeight:700,color:'#1B2A4A',boxSizing:'border-box'}}
          />
        </div>

        {/* Split across bookings */}
        <div style={{fontSize:'12px',fontWeight:700,color:'#1B2A4A',marginBottom:'10px'}}>
          Split across plots
        </div>

        {isLoading ? (
          <div style={{color:'#94a3b8',padding:'20px',textAlign:'center',fontSize:'13px'}}>Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div style={{color:'#94a3b8',padding:'20px',textAlign:'center',fontSize:'13px'}}>No active bookings found for this customer.</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
            {bookings.map(b => {
              const plotLabel = b.plots?.plot_number
                ? `Plot ${b.plots.plot_number}${b.plots.block ? ` (${b.plots.block})` : ''}`
                : 'Plot —'
              const sp = splits[b.id] || { amount:'', remarks:'' }
              return (
                <div key={b.id} style={{
                  background:'#f8fafc',borderRadius:'8px',padding:'12px',
                  border:'1px solid #e2e8f0'
                }}>
                  {/* Plot info */}
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                    <div>
                      <span style={{fontWeight:700,color:'#1B2A4A',fontSize:'13px'}}>{plotLabel}</span>
                      <span style={{color:'#64748b',fontSize:'12px',marginLeft:'8px'}}>{b.projects?.name}</span>
                    </div>
                    <span style={{fontSize:'12px',color:'#64748b'}}>
                      Total: {inr(b.total_price)}
                    </span>
                  </div>
                  {/* Amount + Remarks */}
                  <div style={{display:'grid',gridTemplateColumns:'140px 1fr',gap:'8px'}}>
                    <div>
                      <div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Amount (₹)</div>
                      <input
                        type="number"
                        value={sp.amount}
                        onChange={e=>setSplit(b.id,'amount',e.target.value)}
                        placeholder="0"
                        style={{width:'100%',padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',fontWeight:600,boxSizing:'border-box'}}
                      />
                    </div>
                    <div>
                      <div style={{fontSize:'11px',color:'#64748b',marginBottom:'3px'}}>Remarks</div>
                      <input
                        value={sp.remarks}
                        onChange={e=>setSplit(b.id,'remarks',e.target.value)}
                        placeholder="e.g. Advance, 2nd instalment..."
                        style={{width:'100%',padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
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
                {balanced ? 'Balanced' : `${diff > 0 ? 'Under-allocated' : 'Over-allocated'} by ${inr(Math.abs(diff))}`}
              </span>
              <span style={{color:'#64748b',marginLeft:'8px'}}>
                Allocated {inr(totalSplit)} of {inr(totalAmt)}
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
            {saving ? 'Saving…' : 'Save Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
