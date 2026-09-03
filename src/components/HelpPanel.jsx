// src/components/HelpPanel.jsx
// Reusable collapsible help panel — pass sections as props

import { useState } from 'react'
import { X, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react'

function Section({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{borderBottom:'1px solid #f1f5f9'}}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'10px 16px',background:'none',border:'none',cursor:'pointer',
          textAlign:'left',
        }}
      >
        <span style={{fontSize:'13px',fontWeight:600,color:'#1B2A4A'}}>{title}</span>
        {open ? <ChevronDown size={14} color="#94a3b8"/> : <ChevronRight size={14} color="#94a3b8"/>}
      </button>
      {open && (
        <div style={{padding:'0 16px 14px',fontSize:'12px',color:'#475569',lineHeight:'1.7'}}>
          {children}
        </div>
      )}
    </div>
  )
}

function Step({ number, text }) {
  return (
    <div style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
      <span style={{
        flexShrink:0,width:'18px',height:'18px',borderRadius:'50%',
        background:'#1B2A4A',color:'white',fontSize:'10px',fontWeight:700,
        display:'flex',alignItems:'center',justifyContent:'center',marginTop:'1px'
      }}>{number}</span>
      <span>{text}</span>
    </div>
  )
}

function Field({ name, required, desc }) {
  return (
    <div style={{display:'flex',gap:'6px',marginBottom:'5px',alignItems:'flex-start'}}>
      <span style={{
        flexShrink:0,fontFamily:'monospace',fontSize:'11px',fontWeight:600,
        color:'#1B2A4A',background:'#f1f5f9',padding:'1px 6px',borderRadius:'4px',
        marginTop:'1px'
      }}>
        {name}{required && <span style={{color:'#ef4444'}}> *</span>}
      </span>
      <span style={{color:'#64748b',fontSize:'12px'}}>{desc}</span>
    </div>
  )
}

function Note({ children }) {
  return (
    <div style={{
      background:'#fef9c3',border:'1px solid #fde68a',borderRadius:'6px',
      padding:'8px 10px',marginTop:'8px',fontSize:'12px',color:'#78350f'
    }}>
      💡 {children}
    </div>
  )
}

export default function HelpPanel({ title, onClose, children }) {
  return (
    <div style={{
      position:'fixed',top:0,right:0,bottom:0,
      width:'320px',background:'white',
      boxShadow:'-4px 0 20px rgba(0,0,0,0.12)',
      zIndex:500,display:'flex',flexDirection:'column',
    }}>
      {/* Header */}
      <div style={{
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'14px 16px',borderBottom:'1px solid #e2e8f0',
        background:'#1B2A4A',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <HelpCircle size={16} color="white"/>
          <span style={{fontSize:'14px',fontWeight:700,color:'white'}}>{title}</span>
        </div>
        <button onClick={onClose}
          style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.7)',padding:0}}>
          <X size={18}/>
        </button>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto'}}>
        {children}
      </div>

      {/* Footer */}
      <div style={{
        padding:'10px 16px',borderTop:'1px solid #f1f5f9',
        fontSize:'11px',color:'#94a3b8',textAlign:'center'
      }}>
        KSR MIS — Carob Technologies
      </div>
    </div>
  )
}

// Export sub-components for use in help content
export { Section, Step, Field, Note }
