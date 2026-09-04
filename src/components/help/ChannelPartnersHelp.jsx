// src/components/help/ChannelPartnersHelp.jsx
import HelpPanel, { Section, Step, Field, Note } from '../HelpPanel'

export default function ChannelPartnersHelp({ onClose }) {
  return (
    <HelpPanel title="Channel Partners — Help" onClose={onClose}>

      <Section title="What is this page?">
        Channel Partners (CPs) are external agents or firms who refer customers to KSR.
        When a booking is made through a CP, they are eligible for an incentive/commission
        based on the plot sold. This page maintains the master list of all CPs.
      </Section>

      <Section title="Adding a new channel partner">
        <Step number="1" text="Click + New Channel Partner at the top right." />
        <Step number="2" text="Enter the partner details. Only Name is required." />
        <Step number="3" text="Click Add Channel Partner to save." />
        <Note>Once added, the CP appears in the booking form's Channel Partner dropdown when creating a new booking.</Note>
      </Section>

      <Section title="Field reference">
        <Field name="Name" required desc="Firm name or individual agent name. This appears in booking records and incentive reports." />
        <Field name="Partner Code" desc="Internal reference code e.g. CP-014. Useful for tracking and reporting. Must be unique if entered." />
        <Field name="Contact Person" desc="Name of the individual to contact at the firm, if the CP is a company." />
        <Field name="Mobile" desc="Primary contact number for the CP." />
        <Field name="Email" desc="Email address for the CP." />
        <Field name="Active" desc="Controls whether this CP appears in booking dropdowns. Inactive CPs are hidden from new bookings but their historical records are preserved." />
      </Section>

      <Section title="Editing a channel partner">
        <Step number="1" text="Click the pencil (✏) icon on the CP row." />
        <Step number="2" text="Update the details in the form." />
        <Step number="3" text="Click Update to save." />
        <Note>Updating a CP's name reflects immediately on all linked bookings.</Note>
      </Section>

      <Section title="Deactivating a channel partner">
        <Step number="1" text="Click the pencil (✏) icon to edit the CP." />
        <Step number="2" text="Uncheck the Active checkbox." />
        <Step number="3" text="Click Update." />
        The CP disappears from the booking dropdown but all past bookings and
        incentive records linked to them are preserved.
        <Note>Use Show inactive checkbox in the list to view deactivated CPs.</Note>
      </Section>

      <Section title="Deleting a channel partner">
        <Step number="1" text="Click the trash (🗑) icon on the CP row." />
        <Step number="2" text="Confirm the deletion." />
        <Note>A CP cannot be deleted if they are linked to any booking. Deactivate them instead.</Note>
      </Section>

      <Section title="How CPs connect to bookings">
        When creating a booking in the Bookings module:
        <div style={{marginTop:'8px',display:'flex',flexDirection:'column',gap:'6px'}}>
          {[
            ['CP selected on booking','The CP is credited for that booking and appears in incentive calculations.'],
            ['Paid Directly by CP','If the CP collects payment from the customer and passes it to KSR, tick the "Paid Directly by CP" checkbox on the booking.'],
            ['Incentive Split','In BookingDetail, the Incentive Split section shows what KSR owes the CP for that booking based on the project\'s incentive rate.'],
          ].map(([title, desc], i) => (
            <div key={i} style={{background:'#f8fafc',borderRadius:'6px',padding:'8px 10px',border:'1px solid #e2e8f0'}}>
              <div style={{fontWeight:600,color:'#1B2A4A',fontSize:'12px'}}>{title}</div>
              <div style={{color:'#64748b',fontSize:'11px',marginTop:'2px'}}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Searching channel partners">
        Use the search bar to find CPs by <strong>name</strong>, <strong>partner code</strong>,
        <strong> contact person</strong>, or <strong>mobile number</strong>.
        <br/><br/>
        Tick <strong>Show inactive</strong> to include deactivated partners in the list.
      </Section>

      <Section title="Frequently asked questions">
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {[
            [
              'Can a booking have no channel partner?',
              'Yes — the CP field is optional on every booking. Leave it blank for direct (walk-in) customers.'
            ],
            [
              'What happens to past bookings if a CP is deactivated?',
              'All historical bookings, payments, and incentive records linked to that CP are preserved. Only new bookings cannot be assigned to them.'
            ],
            [
              'Can the same customer be referred by different CPs on different plots?',
              'Yes — each booking independently tracks which CP referred that sale. A customer can have one booking via CP-A and another via CP-B.'
            ],
            [
              'Where do I see how much KSR owes a CP?',
              'Open any booking linked to that CP → BookingDetail → Incentive Split section shows the amount due to the CP for that specific booking.'
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
