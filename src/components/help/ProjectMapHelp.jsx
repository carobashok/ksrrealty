// src/components/help/ProjectMapHelp.jsx
import HelpPanel, { Section, Step, Field, Note } from '../HelpPanel'

export default function ProjectMapHelp({ onClose }) {
  return (
    <HelpPanel title="Project Map — Help" onClose={onClose}>

      <Section title="What is this page?">
        The Project Map shows all KSR projects as pins on an interactive map.
        It gives a quick visual overview of where each project is located,
        how many plots are available, and the current sales status —
        all without leaving the app.
      </Section>

      <Section title="Reading the map">
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'4px'}}>
          {[
            ['Pin number','The number inside each pin shows how many plots are currently available for that project.'],
            ['Pin colour — Green','Mostly available — more than 70% of plots are unsold.'],
            ['Pin colour — Blue','Selling — between 30% and 70% of plots are sold.'],
            ['Pin colour — Navy','Mostly sold — more than 70% of plots are booked or registered.'],
            ['Cluster bubble','When multiple projects are close together, they group into a numbered circle. Click it to zoom in and see individual pins.'],
          ].map(([label, desc], i) => (
            <div key={i} style={{background:'#f8fafc',borderRadius:'6px',padding:'8px 10px',border:'1px solid #e2e8f0'}}>
              <div style={{fontWeight:600,color:'#1B2A4A',fontSize:'12px'}}>{label}</div>
              <div style={{color:'#64748b',fontSize:'11px',marginTop:'2px'}}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Viewing a project from the map">
        <Step number="1" text="Click any project pin on the map." />
        <Step number="2" text="A popup appears showing the project name, plot status breakdown, and total plots." />
        <Step number="3" text="Click View Project → to open the full project detail page." />
        <Step number="4" text="Click the back arrow (←) in the project page to return to the map." />
        <Note>The back arrow always returns you to the map when you arrived from here — it will not take you to the Projects list.</Note>
      </Section>

      <Section title="Navigating the map">
        <div style={{display:'flex',flexDirection:'column',gap:'6px',marginTop:'4px'}}>
          {[
            ['Zoom in / out','Use the + / − buttons (top left) or scroll the mouse wheel.'],
            ['Pan','Click and drag the map to move around.'],
            ['Cluster → individual pins','Click a cluster bubble to zoom in — pins automatically separate.'],
            ['Close a popup','Click anywhere outside the popup or click the pin again.'],
          ].map(([action, desc], i) => (
            <div key={i} style={{display:'flex',gap:'8px',fontSize:'12px'}}>
              <span style={{fontWeight:600,color:'#1B2A4A',minWidth:'160px',flexShrink:0}}>{action}</span>
              <span style={{color:'#64748b'}}>{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Adding a project to the map">
        Projects only appear on the map once their coordinates are set.
        <br/><br/>
        <Step number="1" text="Go to Master → Projects → click the project." />
        <Step number="2" text="Find the Rates section and click Edit Rates." />
        <Step number="3" text="Scroll to the Map Location section at the bottom." />
        <Step number="4" text="Enter Latitude and Longitude." />
        <Step number="5" text="Click Save Rates." />
        The project pin appears on the map immediately.
        <Note>To get coordinates: open Google Maps → right-click the project site → click "What's here?" → the coordinates appear at the bottom of the screen (e.g. 11.0168, 76.9558).</Note>
      </Section>

      <Section title="Projects missing from the map">
        A yellow warning bar at the bottom of the map lists any projects that
        have no coordinates set. Click the warning to see which projects need
        their location added.
        <br/><br/>
        Common reasons a project is missing:
        <div style={{marginTop:'6px',display:'flex',flexDirection:'column',gap:'4px',fontSize:'12px',color:'#64748b'}}>
          <div>• Coordinates not yet entered in the project's Edit Rates form</div>
          <div>• Latitude or longitude entered incorrectly (swapped or wrong sign)</div>
          <div>• Project is new and hasn't been set up yet</div>
        </div>
      </Section>

      <Section title="Map data and accuracy">
        The map uses <strong>OpenStreetMap</strong> — a free, community-maintained
        map similar to Google Maps. No API key or subscription is required.
        <br/><br/>
        The pin locations are only as accurate as the coordinates entered in the
        project settings. Always verify coordinates by checking the "View on Google Maps"
        link in the project's Edit Rates section before saving.
      </Section>

      <Section title="Frequently asked questions">
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {[
            [
              'Two projects are in the same location — can I tell them apart?',
              'Yes — click the cluster bubble to zoom in. Pins will spread apart at higher zoom levels. Each pin\'s popup shows the project name clearly.'
            ],
            [
              'The map is showing the wrong location for a project — how do I fix it?',
              'Go to that project\'s Edit Rates form, correct the Latitude and Longitude, and save. The pin moves immediately on the next page load.'
            ],
            [
              'Can I see satellite view instead of street map?',
              'Not currently — the map uses the standard OpenStreetMap street view. Satellite imagery can be added in a future update if needed.'
            ],
            [
              'Why does the pin show 0 available plots when there are available plots?',
              'This can happen if the plots haven\'t been imported yet for that project, or if the plot type is not set to "plot". Check the project\'s inventory page.'
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
