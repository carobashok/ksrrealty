// src/components/help/EmployeesHelp.jsx
// Help content for the Employees master page

import HelpPanel, { Section, Step, Field, Note } from '../HelpPanel'

export default function EmployeesHelp({ onClose }) {
  return (
    <HelpPanel title="Employees — Help" onClose={onClose}>

      <Section title="What is this page?">
        The Employees page maintains the list of KSR staff. Employee records are used
        to track who is responsible for bookings, assign roles, and set up reporting
        hierarchies. Only active employees appear in booking and assignment dropdowns.
      </Section>

      <Section title="Adding a new employee">
        <Step number="1" text="Click the blue + Add Employee button at the top right." />
        <Step number="2" text="Fill in the employee details in the form that slides open on the right." />
        <Step number="3" text="Click Save Employee. The new employee appears in the list immediately." />
        <Note>Name and Role are required. All other fields are optional but recommended.</Note>
      </Section>

      <Section title="Field reference">
        <Field name="Name" required desc="Full name of the employee as it should appear in records and reports." />
        <Field name="Employee Code" desc="Internal code e.g. KSR-EMP-014. Useful for payroll reference. Must be unique." />
        <Field name="Role" required desc="Select from: Sales Executive, Sales Manager, Presales, Project Head, MD, Accounts, or Admin." />
        <Field name="Reports To" desc="Select the employee's direct manager. Used for hierarchy and approval workflows." />
        <Field name="Mobile" desc="Primary contact number. Shown in the employee card for quick reference." />
        <Field name="Email" desc="Work email address." />
        <Field name="Active" desc="Toggle on/off. Inactive employees are hidden from all assignment dropdowns but their historical records are preserved." />
      </Section>

      <Section title="Editing an employee">
        <Step number="1" text="Click on any employee card in the list." />
        <Step number="2" text="The form opens on the right with existing details pre-filled." />
        <Step number="3" text="Make your changes and click Save Employee." />
        <Note>Changing a role does not affect past bookings already assigned to this employee.</Note>
      </Section>

      <Section title="Deactivating an employee">
        <Step number="1" text="Open the employee record by clicking their card." />
        <Step number="2" text="Uncheck the Active toggle." />
        <Step number="3" text="Click Save Employee." />
        The employee will no longer appear in booking assignment dropdowns.
        Their name still shows on any existing bookings they are linked to.
        <Note>Do not delete employees — deactivate them to preserve historical records.</Note>
      </Section>

      <Section title="Searching and filtering">
        Use the search bar to find employees by <strong>name</strong>, <strong>employee code</strong>,
        <strong> role</strong>, or <strong>mobile number</strong>.
        <br/><br/>
        Use the <strong>Show inactive</strong> checkbox to view deactivated employees.
        By default, only active employees are shown.
      </Section>

      <Section title="Roles explained">
        <div style={{display:'flex',flexDirection:'column',gap:'6px',marginTop:'4px'}}>
          {[
            ['Sales Executive', 'Front-line sales staff, directly handles customer enquiries and bookings.'],
            ['Sales Manager', 'Oversees sales executives, reviews and approves bookings.'],
            ['Presales', 'Handles initial enquiries, site visits, and lead qualification before booking.'],
            ['Project Head', 'Responsible for a specific project or layout.'],
            ['MD', 'Managing Director — top-level access and approval.'],
            ['Accounts', 'Manages receipts, payments, and financial records in the MIS.'],
            ['Admin', 'General administration, document management, and data entry.'],
          ].map(([role, desc]) => (
            <div key={role} style={{background:'#f8fafc',borderRadius:'6px',padding:'8px 10px'}}>
              <div style={{fontWeight:600,color:'#1B2A4A',fontSize:'12px'}}>{role}</div>
              <div style={{color:'#64748b',fontSize:'11px',marginTop:'2px'}}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Frequently asked questions">
        <div style={{marginBottom:'10px'}}>
          <div style={{fontWeight:600,color:'#1B2A4A',marginBottom:'3px'}}>
            Can I delete an employee?
          </div>
          <div style={{color:'#64748b'}}>
            No — deletion is not available because employees may be linked to bookings,
            receipts, and other records. Deactivate them instead using the Active toggle.
          </div>
        </div>
        <div style={{marginBottom:'10px'}}>
          <div style={{fontWeight:600,color:'#1B2A4A',marginBottom:'3px'}}>
            An employee left and joined back — what do I do?
          </div>
          <div style={{color:'#64748b'}}>
            Reactivate the existing record by switching the Active toggle back on.
            Do not create a duplicate entry.
          </div>
        </div>
        <div>
          <div style={{fontWeight:600,color:'#1B2A4A',marginBottom:'3px'}}>
            How many employees can I add?
          </div>
          <div style={{color:'#64748b'}}>
            There is no limit on the number of employee records.
          </div>
        </div>
      </Section>

    </HelpPanel>
  )
}
