// src/components/help/DocumentsHelp.jsx
import HelpPanel, { Section, Step, Field, Note } from '../HelpPanel'

export default function DocumentsHelp({ onClose }) {
  return (
    <HelpPanel title="Documents — Help" onClose={onClose}>

      <Section title="What is this page?">
        The Documents page stores and manages files linked to KSR projects —
        sale deeds, layout plans, NOCs, approval letters, and any other
        project-related documents. All files are stored in Google Drive and
        linked here for easy access within the MIS.
      </Section>

      <Section title="Before you start">
        Google Drive must be connected before uploading or importing documents.
        <br/><br/>
        If you see an amber warning — <strong>"Google Drive not connected"</strong> —
        go to <strong>Settings → Google Drive Integration</strong> and connect
        using <strong>legal.ksrrealty@gmail.com</strong>.
        <Note>Once Drive is connected, all uploads go directly from your browser to the KSR Drive folder — no file size limit applies.</Note>
      </Section>

      <Section title="Uploading a new document">
        <Step number="1" text="Select a project from the All Projects dropdown — the action bar appears." />
        <Step number="2" text="Click Upload File in the action bar." />
        <Step number="3" text="Choose the file from your computer." />
        <Step number="4" text="Wait for the upload to complete — a success message confirms it." />
        The file is uploaded to that project's folder in Google Drive and
        immediately appears in the documents list.
        <Note>If this is the first upload for a project, the system automatically creates a folder for it inside the KSR Drive root folder.</Note>
      </Section>

      <Section title="Importing from Google Drive">
        If files were uploaded directly to Google Drive (not through the MIS),
        use Import from Drive to bring them into the documents list.
        <Step number="1" text="Select the project from the dropdown." />
        <Step number="2" text="Click Import from Drive in the action bar." />
        <Step number="3" text="The system scans that project's Drive folder and adds any new files." />
        Already-imported files are skipped — no duplicates are created.
        <Note>Import from Drive only works if the project already has a Drive folder linked. Upload at least one file first to create the folder automatically.</Note>
      </Section>

      <Section title="Viewing a document">
        <Step number="1" text="Find the document in the list." />
        <Step number="2" text="Click the external link icon (↗) in the Actions column." />
        <Step number="3" text="The file opens in Google Drive in a new browser tab." />
        From Google Drive you can view, download, print, or share the file.
      </Section>

      <Section title="Removing a document from the MIS">
        <Step number="1" text="Find the document in the list." />
        <Step number="2" text="Click the trash icon (🗑) in the Actions column." />
        <Step number="3" text="Confirm the removal." />
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'6px',padding:'8px 10px',marginTop:'8px',fontSize:'12px',color:'#dc2626'}}>
          ⚠ Removing a document from the MIS does <strong>not</strong> delete it from
          Google Drive. The file remains in Drive — only the link in the MIS is removed.
          To permanently delete, open the file in Drive and delete it there.
        </div>
      </Section>

      <Section title="Searching and filtering">
        <div style={{display:'flex',flexDirection:'column',gap:'6px',marginTop:'4px'}}>
          {[
            ['Search bar','Find documents by file name or project name. Results update instantly as you type.'],
            ['Project dropdown','Filter to show only documents for a specific project. Also enables the Upload and Import actions.'],
            ['All Projects','Clear the project filter to see all documents across every project.'],
          ].map(([label, desc], i) => (
            <div key={i} style={{display:'flex',gap:'8px',fontSize:'12px'}}>
              <span style={{fontWeight:600,color:'#1B2A4A',minWidth:'130px',flexShrink:0}}>{label}</span>
              <span style={{color:'#64748b'}}>{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="How Google Drive folders are organised">
        KSR documents are stored in Drive with this structure:
        <div style={{
          fontFamily:'monospace',fontSize:'11px',background:'#f8fafc',
          border:'1px solid #e2e8f0',borderRadius:'6px',padding:'10px 12px',
          marginTop:'8px',lineHeight:'1.8',color:'#475569'
        }}>
          📁 Layout Sale Deeds (root)<br/>
          &nbsp;&nbsp;📁 Raja Avenue<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;📄 Sale Deed - Plot A1.pdf<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;📄 NOC - Raja Avenue.pdf<br/>
          &nbsp;&nbsp;📁 JRS Enclave<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;📄 Layout Plan.pdf<br/>
          &nbsp;&nbsp;📁 Thenmozhi Enclave<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;📄 Approval Letter.pdf
        </div>
        Each project gets its own folder created automatically on first upload.
      </Section>

      <Section title="Frequently asked questions">
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {[
            [
              'Is there a file size limit?',
              'No — uploads go directly from your browser to Google Drive using the resumable upload API. Large files like high-resolution layout PDFs upload without issues.'
            ],
            [
              'What file types are supported?',
              'Any file type — PDF, Word, Excel, images, DXF, etc. Google Drive can preview most common formats directly in the browser.'
            ],
            [
              'Can I upload the same file twice?',
              'The system detects duplicates by Drive file ID and skips them during import. For direct uploads, a new copy is created each time.'
            ],
            [
              'A file shows in Drive but not in the MIS — how do I add it?',
              'Select the project from the dropdown and click Import from Drive. The system will scan the project folder and add any files not yet in the MIS.'
            ],
            [
              'Can I rename a document in the MIS?',
              'Not currently — the file name shown is taken from Google Drive. To rename, open the file in Drive, rename it there, then remove and re-import it in the MIS.'
            ],
            [
              'The Upload button is greyed out — why?',
              'Either Google Drive is not connected (go to Settings to reconnect), or no project is selected from the dropdown (select a project first to enable the upload button).'
            ],
          ].map(([q, a], i) => (
            <div key={i}>
              <div style={{fontWeight:600,color:'#1B2A4A',fontSize:'12px',marginBottom:'3px'}}>{q}</div>
              <div style={{color:'#64748b',fontSize:'12px'}}>{a}</div>
            </div>
          ))}
        </div>
      </Section>

    </HelpPanel>
  )
}
