// src/components/help/CustomersHelp.jsx
import HelpPanel, { Section, Step, Field, Note } from '../HelpPanel'

export default function CustomersHelp({ onClose }) {
  return (
    <HelpPanel title="Customers — Help" onClose={onClose}>

      <Section title="What is this page?">
        The Customers page is the master list of all plot buyers. Every booking must
        be linked to a customer record. Customer records also track deposits (advance
        amounts held by KSR before a booking is created) and cancellation refunds
        held for reuse.
      </Section>

      <Section title="Adding a new customer">
        <Step number="1" text="Click + New Customer at the top right." />
        <Step number="2" text="Fill in the customer details. Only Name is mandatory." />
        <Step number="3" text="Click Save. The customer appears in the list immediately." />
        <Note>A customer must exist before a booking can be created for them.</Note>
      </Section>

      <Section title="Field reference">
        <Field name="Name" required desc="Full name of the customer. Used on quotations, receipts, and all documents." />
        <Field name="Mobile" desc="10-digit mobile number. Used for search and contact reference." />
        <Field name="Email" desc="Email address for communication." />
        <Field name="Address" desc="Residential or correspondence address. Appears on quotations." />
        <Field name="PAN" desc="Permanent Account Number. Required for registration and TDS purposes." />
        <Field name="Aadhaar" desc="Aadhaar number for KYC. Stored securely." />
      </Section>

      <Section title="Editing a customer">
        <Step number="1" text="Click the pencil (✏) icon on any customer row." />
        <Step number="2" text="Update the details in the form." />
        <Step number="3" text="Click Save." />
        <Note>Editing a customer updates their name and details across all linked bookings, quotations, and receipts automatically.</Note>
      </Section>

      <Section title="Deleting a customer">
        <Step number="1" text="Click the trash (🗑) icon on the customer row." />
        <Step number="2" text="Confirm the deletion in the prompt." />
        <Note>A customer cannot be deleted if they have active bookings. Cancel or transfer the bookings first.</Note>
      </Section>

      <Section title="Customer Wallet / Deposits">
        The wallet button (💳) on each customer row opens their deposit ledger.
        This tracks money KSR is holding on behalf of the customer — before a booking
        is created, or from a cancellation refund.
        <br/><br/>
        <strong>When to use the wallet:</strong>
        <div style={{marginTop:'8px',display:'flex',flexDirection:'column',gap:'6px'}}>
          {[
            ['Customer pays advance before plot is finalised','Record it as a deposit. Later apply it when creating the booking.'],
            ['Cancellation refund held for reuse','Automatically appears in wallet when "Hold for Customer" is selected during cancellation.'],
            ['Customer transfers money for a friend','Hold it as a deposit, then apply when the friend\'s booking is created.'],
          ].map(([when, what], i) => (
            <div key={i} style={{background:'#f8fafc',borderRadius:'6px',padding:'8px 10px'}}>
              <div style={{fontWeight:600,color:'#1B2A4A',fontSize:'12px'}}>{when}</div>
              <div style={{color:'#64748b',fontSize:'11px',marginTop:'2px'}}>{what}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recording a deposit">
        <Step number="1" text="Click the wallet (💳) icon on the customer row." />
        <Step number="2" text="Click + Add Deposit in the deposit panel." />
        <Step number="3" text="Enter the date, amount, mode, and reference number." />
        <Step number="4" text="Click Save Deposit." />
        The deposit appears in the ledger with status <strong>Held</strong>.
        It will show as available credit when creating a new booking for this customer.
        <Note>The available balance shown at the top of the wallet is the total of all Held deposits — already-applied amounts are excluded.</Note>
      </Section>

      <Section title="Searching customers">
        Use the search bar to find customers by <strong>name</strong>, <strong>mobile number</strong>,
        or <strong>email</strong>. The search is instant — no need to press Enter.
      </Section>

      <Section title="Viewing a customer's bookings">
        Customer records on this page show contact details and wallet balance only.
        To see a customer's full booking history, go to the <strong>Bookings</strong> page
        and search by the customer's name.
      </Section>

      <Section title="Frequently asked questions">
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {[
            [
              'Can two customers have the same name?',
              'Yes — there is no uniqueness check on names. Use mobile number to distinguish between customers with the same name.'
            ],
            [
              'A customer bought plots jointly (e.g. husband and wife) — one record or two?',
              'Create one record with both names combined (e.g. "Ramesh & Priya Kumar"). The booking and documents will show the combined name.'
            ],
            [
              'Can I see how much a customer has paid in total?',
              'Open the customer\'s booking from the Bookings page — the BookingDetail shows the full payment ledger including total paid and pending.'
            ],
            [
              'What happens to the wallet if a booking is cancelled?',
              'If "Hold for Customer" is selected during cancellation, the refund amount automatically appears in the customer\'s wallet as a new deposit entry.'
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
