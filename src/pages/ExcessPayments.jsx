// src/pages/ExcessPayments.jsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')
const MODES = ['cash', 'cheque', 'neft', 'rtgs', 'upi', 'dd', 'imps']

// ── Settlement Modal ────────────────────────────────────────────────────────
function SettlementModal({ row, onClose, onDone }) {
  const qc = useQueryClient()
  const [action, setAction]       = useState(null) // 'refund' | 'adjust' | 'hold'
  const [amount, setAmount]       = useState(String(row.excess))
  const [mode, setMode]           = useState('cash')
  const [refNo, setRefNo]         = useState('')
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes]         = useState('')
  const [targetBooking, setTarget] = useState('')
  const [saving, setSaving]       = useState(false)

  // Other active bookings for this customer (for Adjust action)
  const { data: otherBookings = [] } = useQuery({
    queryKey: ['other-bookings-excess', row.customer_id, row.booking_id],
    enabled: action === 'adjust',
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('bookings')
        .select(`
          id,
          plots ( plot_number, block ),
          projects ( name )
        `)
        .eq('customer_id', row.customer_id)
        .neq('id', row.booking_id)
        .in('status', ['booked', 'registered'])
      if (error) throw error
      return data
    },
  })

  const amt = parseFloat(amount) || 0
  const valid = amt > 0 && amt <= row.excess &&
    (action === 'refund'
      ? true
      : action === 'adjust'
      ? !!targetBooking
      : action === 'hold'
      ? true
      : false)

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    try {
      if (action === 'refund') {
        // Insert a negative/refund payment row against this booking
        const { error } = await supabase
          .schema('ksr')
          .from('payments')
          .insert({
            booking_id:   row.booking_id,
            payment_type: 'company_share',
            paid_by:      'plot_purchaser',
            payment_date: date,
            amount:       -amt,   // negative = refund out
            mode,
            reference_no: refNo || null,
            notes:        notes || 'Excess payment refund',
          })
        if (error) throw error
        toast.success(`Refund of ${inr(amt)} recorded`)

      } else if (action === 'adjust') {
        // Create customer_deposit for the target booking
        const { error } = await supabase
          .schema('ksr')
          .from('customer_deposits')
          .insert({
            customer_id:       row.customer_id,
            booking_id:        targetBooking,
            source_booking_id: row.booking_id,
            amount:            amt,
            notes:             notes || `Excess transferred from Plot ${row.plot_number}`,
            deposit_date:      date,
          })
        if (error) throw error
        toast.success(`${inr(amt)} adjusted to selected plot`)

      } else if (action === 'hold') {
        // Create unallocated customer_deposit (no specific booking)
        const { error } = await supabase
          .schema('ksr')
          .from('customer_deposits')
          .insert({
            customer_id:       row.customer_id,
            booking_id:        null,
            source_booking_id: row.booking_id,
            amount:            amt,
            notes:             notes || `Excess from Plot ${row.plot_number} held as deposit`,
            deposit_date:      date,
          })
        if (error) throw error
        toast.success(`${inr(amt)} held as customer deposit`)
      }

      qc.invalidateQueries(['excess-payments'])
      onDone()
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
        width:'100%',maxWidth:'520px',
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{marginBottom:'20px'}}>
          <div style={{fontSize:'16px',fontWeight:700,color:'#1B2A4A'}}>
            Settle Excess Payment
          </div>
          <div style={{fontSize:'12px',color:'#64748b',marginTop:'4px'}}>
            {row.customer} · {row.project} · Plot {row.plot_number}
          </div>
          <div style={{
            display:'inline-block',marginTop:'8px',
            padding:'4px 12px',borderRadius:'20px',
            background:'#fef2f2',border:'1px solid #fecaca',
            fontSize:'13px',fontWeight:600,color:'#dc2626'
          }}>
            Excess: {inr(row.excess)}
          </div>
        </div>

        {/* Action selector */}
        <div style={{fontSize:'11px',fontWeight:700,color:'#64748b',marginBottom:'8px',letterSpacing:'0.05em'}}>
          HOW TO SETTLE
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
          {[
            { key:'refund',  label:'Refund to Customer',         desc:'Return the excess amount to the customer via cash / bank transfer' },
            { key:'adjust',  label:'Adjust to Another Plot',     desc:'Credit this amount against another booking of the same customer' },
            { key:'hold',    label:'Hold as Customer Deposit',   desc:'Keep as unallocated credit — can be applied to a future booking' },
          ].map(opt => (
            <label key={opt.key} style={{
              display:'flex',alignItems:'flex-start',gap:'10px',
              padding:'10px 12px',borderRadius:'8px',cursor:'pointer',
              border:`1px solid ${action===opt.key ? '#1B2A4A' : '#e2e8f0'}`,
              background: action===opt.key ? '#f8fafc' : 'white',
            }}>
              <input type="radio" name="action" value={opt.key}
                checked={action===opt.key}
                onChange={() => setAction(opt.key)}
                style={{marginTop:'2px'}}
              />
              <div>
                <div style={{fontSize:'13px',fontWeight:600,color:'#1B2A4A'}}>{opt.label}</div>
                <div style={{fontSize:'11px',color:'#64748b',marginTop:'2px'}}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Action-specific fields */}
        {action && (
          <div style={{background:'#f8fafc',borderRadius:'8px',padding:'14px',marginBottom:'16px'}}>
            {/* Amount */}
            <div style={{marginBottom:'10px'}}>
              <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>
                AMOUNT (₹) — max {inr(row.excess)}
              </div>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                max={row.excess}
                style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'14px',fontWeight:600,boxSizing:'border-box'}}
              />
              {amt > row.excess && (
                <div style={{fontSize:'11px',color:'#ef4444',marginTop:'4px'}}>
                  Cannot exceed excess of {inr(row.excess)}
                </div>
              )}
            </div>

            {/* Date */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>DATE</div>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}/>
              </div>

              {/* Mode — only for refund */}
              {action === 'refund' && (
                <div>
                  <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>MODE</div>
                  <select value={mode} onChange={e=>setMode(e.target.value)}
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',background:'white',boxSizing:'border-box'}}>
                    {MODES.map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
              )}

              {/* Reference — only for refund */}
              {action === 'refund' && (
                <div style={{gridColumn:'1/-1'}}>
                  <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>REFERENCE NO.</div>
                  <input value={refNo} onChange={e=>setRefNo(e.target.value)}
                    placeholder="UTR / Cheque no."
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}/>
                </div>
              )}
            </div>

            {/* Target booking — only for adjust */}
            {action === 'adjust' && (
              <div style={{marginBottom:'10px'}}>
                <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>ADJUST TO PLOT</div>
                {otherBookings.length === 0 ? (
                  <div style={{fontSize:'12px',color:'#ef4444',padding:'8px',background:'#fef2f2',borderRadius:'6px'}}>
                    No other active bookings found for this customer.
                    Use "Hold as Deposit" instead.
                  </div>
                ) : (
                  <select value={targetBooking} onChange={e=>setTarget(e.target.value)}
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',background:'white',boxSizing:'border-box'}}>
                    <option value="">Select plot...</option>
                    {otherBookings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.projects?.name} · Plot {b.plots?.plot_number}{b.plots?.block ? ` (${b.plots.block})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px',fontWeight:600}}>NOTES (optional)</div>
              <input value={notes} onChange={e=>setNotes(e.target.value)}
                placeholder="Any remarks..."
                style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'}}/>
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
            disabled={saving || !valid}
            style={{
              padding:'8px 20px',
              background: valid ? '#1B2A4A' : '#94a3b8',
              color:'white',border:'none',borderRadius:'7px',
              fontSize:'13px',fontWeight:600,
              cursor: valid ? 'pointer' : 'not-allowed'
            }}>
            {saving ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ExcessPayments() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState(null)

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['excess-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .rpc('get_excess_payments')
      if (error) {
        // Fallback: raw query via from()
        const { data: d2, error: e2 } = await supabase
          .schema('ksr')
          .from('bookings')
          .select(`
            id,
            customer_id,
            customers ( name, mobile ),
            projects ( name ),
            plots ( plot_number, block, total_price ),
            payments ( amount, paid_by )
          `)
          .in('status', ['booked', 'registered'])
        if (e2) throw e2

        return d2
          .map(b => {
            const paid = (b.payments || [])
              .filter(p => p.paid_by === 'plot_purchaser')
              .reduce((s, p) => s + Number(p.amount), 0)
            const excess = paid - Number(b.plots?.total_price || 0)
            return {
              booking_id:   b.id,
              customer_id:  b.customer_id,
              customer:     b.customers?.name,
              mobile:       b.customers?.mobile,
              project:      b.projects?.name,
              plot_number:  b.plots?.plot_number,
              block:        b.plots?.block,
              total_price:  Number(b.plots?.total_price || 0),
              total_paid:   paid,
              excess,
            }
          })
          .filter(r => r.excess > 0)
          .sort((a, b) => b.excess - a.excess)
      }
      return data
    },
  })

  const totalExcess = rows.reduce((s, r) => s + r.excess, 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Excess Payments</h1>
          <p className="text-sm text-slate-500">
            Bookings where customer has paid more than the plot price
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">Bookings with Excess</div>
          <div className="text-2xl font-semibold text-slate-800 mt-1">{rows.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4">
          <div className="text-xs text-slate-400">Total Excess Amount</div>
          <div className="text-2xl font-semibold text-red-600 mt-1">{inr(totalExcess)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">Unique Customers</div>
          <div className="text-2xl font-semibold text-slate-800 mt-1">
            {new Set(rows.map(r => r.customer_id)).size}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No excess payments found — all bookings are within their plot price.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Project / Plot</th>
                <th className="text-right px-4 py-3">Plot Price</th>
                <th className="text-right px-4 py-3">Total Paid</th>
                <th className="text-right px-4 py-3">Excess</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.booking_id}
                  className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{r.customer}</div>
                    <div className="text-slate-400 text-xs">{r.mobile}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.project}
                    <span className="text-slate-400">
                      {' · Plot '}{r.plot_number}{r.block ? ` (${r.block})` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{inr(r.total_price)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{inr(r.total_paid)}</td>
                  <td className="px-4 py-3 text-right">
                    <span style={{
                      fontWeight:700,color:'#dc2626',
                      background:'#fef2f2',padding:'2px 10px',
                      borderRadius:'20px',fontSize:'12px'
                    }}>
                      {inr(r.excess)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(r)}
                      style={{
                        padding:'5px 14px',background:'#1B2A4A',color:'white',
                        border:'none',borderRadius:'6px',fontSize:'12px',
                        fontWeight:600,cursor:'pointer'
                      }}>
                      Settle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Settlement modal */}
      {selected && (
        <SettlementModal
          row={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null)
            qc.invalidateQueries(['excess-payments'])
          }}
        />
      )}
    </div>
  )
}
