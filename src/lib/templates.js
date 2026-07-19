// Built-in document templates. Plain data — safe to import on the client.

export const TEMPLATES = [
  {
    id: "nda",
    name: "Non-Disclosure Agreement",
    description: "Mutual NDA to protect confidential information shared between two parties.",
    icon: "shield",
    html: `<h1>Mutual Non-Disclosure Agreement</h1><p>This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of <strong>[Date]</strong> by and between <strong>[Party A]</strong>, located at [Address], and <strong>[Party B]</strong>, located at [Address] (each a "Party" and together the "Parties").</p><h2>1. Purpose</h2><p>The Parties wish to explore a potential business relationship (the "Purpose") and, in connection with the Purpose, may disclose to each other certain confidential technical and business information that the disclosing Party desires to keep confidential.</p><h2>2. Definition of Confidential Information</h2><p>"Confidential Information" means any information disclosed by either Party to the other, directly or indirectly, in writing, orally, or by inspection of tangible objects, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.</p><h2>3. Obligations</h2><ul><li>Hold the other Party's Confidential Information in strict confidence.</li><li>Not disclose such Confidential Information to any third party without prior written consent.</li><li>Use the Confidential Information solely for the Purpose.</li><li>Protect it with at least the same degree of care used for its own confidential information, and no less than reasonable care.</li></ul><h2>4. Exclusions</h2><p>Confidential Information does not include information that: (a) was publicly known at the time of disclosure; (b) becomes publicly known through no fault of the receiving Party; (c) was rightfully known prior to disclosure; or (d) is independently developed without use of the Confidential Information.</p><h2>5. Term</h2><p>This Agreement shall remain in effect for <strong>[Number]</strong> years from the date first written above. The confidentiality obligations shall survive termination for a period of [Number] years.</p><h2>6. Governing Law</h2><p>This Agreement shall be governed by and construed in accordance with the laws of <strong>[Jurisdiction]</strong>.</p><p><br /></p><table><tbody><tr><th><p>Party A</p></th><th><p>Party B</p></th></tr><tr><td><p>Signature: ______________________</p><p>Name: [Name]</p><p>Date: [Date]</p></td><td><p>Signature: ______________________</p><p>Name: [Name]</p><p>Date: [Date]</p></td></tr></tbody></table>`,
  },
  {
    id: "rent-agreement",
    name: "Rent Agreement",
    description: "Residential rental agreement between a landlord and a tenant.",
    icon: "home",
    html: `<h1>Residential Rent Agreement</h1><p>This Rent Agreement is made on <strong>[Date]</strong> between <strong>[Landlord Name]</strong> ("Landlord") and <strong>[Tenant Name]</strong> ("Tenant") for the property located at <strong>[Property Address]</strong> (the "Premises").</p><h2>1. Term</h2><p>The tenancy shall commence on [Start Date] and continue for a period of [Duration], ending on [End Date], unless renewed or terminated earlier in accordance with this Agreement.</p><h2>2. Rent &amp; Deposit</h2><ul><li>Monthly rent: <strong>[Amount]</strong>, payable in advance on or before the [Day] of each month.</li><li>Security deposit: <strong>[Amount]</strong>, refundable at the end of the tenancy subject to deductions for damages beyond normal wear and tear.</li><li>Payment method: [Bank transfer / other].</li></ul><h2>3. Utilities &amp; Maintenance</h2><p>The Tenant shall pay for [electricity, water, internet, gas]. The Landlord shall be responsible for structural repairs and major maintenance. The Tenant shall keep the Premises clean and in good condition.</p><h2>4. Use of Premises</h2><p>The Premises shall be used solely for residential purposes by the Tenant and their immediate family. Subletting requires the Landlord's prior written consent.</p><h2>5. Termination</h2><p>Either party may terminate this Agreement by giving <strong>[Notice Period]</strong> written notice. On termination, the Tenant shall hand over vacant possession of the Premises in good condition.</p><h2>6. Signatures</h2><table><tbody><tr><th><p>Landlord</p></th><th><p>Tenant</p></th></tr><tr><td><p>Signature: ______________________</p><p>Name: [Landlord Name]</p><p>Date: [Date]</p></td><td><p>Signature: ______________________</p><p>Name: [Tenant Name]</p><p>Date: [Date]</p></td></tr></tbody></table><p><em>Witnessed by: [Witness Name], [Date]</em></p>`,
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    description: "Professional cover letter for a job or program application.",
    icon: "mail",
    html: `<p><strong>[Your Name]</strong><br />[Email] | [Phone] | [LinkedIn]</p><p>[Date]</p><p><strong>[Hiring Manager Name]</strong><br />[Company Name]<br />[Company Address]</p><p>Dear [Hiring Manager Name],</p><p>I am writing to express my strong interest in the <strong>[Position Title]</strong> role at [Company Name]. With [X years] of experience in [field/skill area], I am confident that my background in [key skill 1] and [key skill 2] makes me a great fit for your team.</p><p>In my current role at [Current Company], I have [key achievement with a measurable result]. Previously at [Previous Company], I [second achievement]. These experiences sharpened exactly the skills your posting calls for: [skill], [skill], and [skill].</p><p>What draws me to [Company Name] specifically is [something concrete about the company — product, mission, culture]. I would love the chance to bring my experience in [area] to help [team goal or company objective].</p><p>Thank you for your time and consideration. I would welcome the opportunity to discuss how I can contribute to [Company Name], and I am happy to provide further examples of my work.</p><p>Sincerely,<br /><strong>[Your Name]</strong></p>`,
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Structured notes with attendees, agenda, decisions, and action items.",
    icon: "clipboard",
    html: `<h1>Meeting Notes — [Topic]</h1><p><strong>Date:</strong> [Date] · <strong>Time:</strong> [Start]–[End] · <strong>Location:</strong> [Room / Link]</p><h2>Attendees</h2><ul><li>[Name] — [Role]</li><li>[Name] — [Role]</li><li>[Name] — [Role]</li></ul><h2>Agenda</h2><ol><li>[Agenda item one]</li><li>[Agenda item two]</li><li>[Agenda item three]</li></ol><h2>Discussion</h2><p>[Summary of the key points discussed, options considered, and context worth remembering.]</p><h2>Decisions</h2><ul><li>[Decision made and why]</li><li>[Decision made and why]</li></ul><h2>Action Items</h2><table><tbody><tr><th><p>Action</p></th><th><p>Owner</p></th><th><p>Due</p></th></tr><tr><td><p>[Task]</p></td><td><p>[Name]</p></td><td><p>[Date]</p></td></tr><tr><td><p>[Task]</p></td><td><p>[Name]</p></td><td><p>[Date]</p></td></tr></tbody></table><h2>Next Meeting</h2><p>[Date, time, and tentative agenda.]</p>`,
  },
  {
    id: "project-proposal",
    name: "Project Proposal",
    description: "Pitch a project with goals, scope, timeline, and budget.",
    icon: "rocket",
    html: `<h1>Project Proposal: [Project Name]</h1><p><strong>Prepared by:</strong> [Your Name] · <strong>Date:</strong> [Date] · <strong>For:</strong> [Stakeholder / Client]</p><h2>Executive Summary</h2><p>[Two or three sentences: the problem, the proposed solution, and the headline outcome you expect.]</p><h2>Problem Statement</h2><p>[What is broken or missing today, who it affects, and what it costs to leave it unsolved.]</p><h2>Goals &amp; Success Metrics</h2><ul><li>[Goal 1] — measured by [metric]</li><li>[Goal 2] — measured by [metric]</li><li>[Goal 3] — measured by [metric]</li></ul><h2>Scope</h2><p><strong>In scope:</strong> [deliverables included].</p><p><strong>Out of scope:</strong> [explicitly excluded items].</p><h2>Timeline</h2><table><tbody><tr><th><p>Phase</p></th><th><p>Deliverable</p></th><th><p>Dates</p></th></tr><tr><td><p>Discovery</p></td><td><p>[Deliverable]</p></td><td><p>[Dates]</p></td></tr><tr><td><p>Build</p></td><td><p>[Deliverable]</p></td><td><p>[Dates]</p></td></tr><tr><td><p>Launch</p></td><td><p>[Deliverable]</p></td><td><p>[Dates]</p></td></tr></tbody></table><h2>Budget</h2><p>[Estimated cost breakdown — people, tools, services.]</p><h2>Risks &amp; Mitigations</h2><ul><li><strong>[Risk]</strong> — [mitigation]</li><li><strong>[Risk]</strong> — [mitigation]</li></ul><h2>Next Steps</h2><p>[What approval or input you need, and what happens immediately after sign-off.]</p>`,
  },
  {
    id: "invoice",
    name: "Invoice",
    description: "Simple invoice with line items, totals, and payment details.",
    icon: "receipt",
    html: `<h1>Invoice</h1><p><strong>Invoice #:</strong> [0001] · <strong>Date:</strong> [Date] · <strong>Due:</strong> [Due Date]</p><table><tbody><tr><th><p>From</p></th><th><p>Bill To</p></th></tr><tr><td><p><strong>[Your Name / Company]</strong></p><p>[Address]</p><p>[Email] · [Phone]</p></td><td><p><strong>[Client Name / Company]</strong></p><p>[Address]</p><p>[Email]</p></td></tr></tbody></table><h2>Items</h2><table><tbody><tr><th><p>Description</p></th><th><p>Qty</p></th><th><p>Rate</p></th><th><p>Amount</p></th></tr><tr><td><p>[Service or product]</p></td><td><p>1</p></td><td><p>[0.00]</p></td><td><p>[0.00]</p></td></tr><tr><td><p>[Service or product]</p></td><td><p>1</p></td><td><p>[0.00]</p></td><td><p>[0.00]</p></td></tr></tbody></table><p style="text-align: right"><strong>Subtotal:</strong> [0.00]<br /><strong>Tax ([0]%):</strong> [0.00]<br /><strong>Total due: [0.00]</strong></p><h2>Payment Details</h2><p>[Bank name, account number / UPI / PayPal — and any payment reference to include.]</p><p><em>Thank you for your business! Payment is due within [N] days.</em></p>`,
  },
  {
    id: "resume",
    name: "Resume",
    description: "Clean one-page resume with experience, skills, and education.",
    icon: "user",
    html: `<h1>[Your Name]</h1><p>[City, Country] · [Email] · [Phone] · [LinkedIn / GitHub / Portfolio]</p><h2>Summary</h2><p>[Two sentences: who you are professionally, your standout strengths, and what you're looking for.]</p><h2>Experience</h2><h3>[Job Title] — [Company]</h3><p><em>[Start] – [End] · [Location]</em></p><ul><li>[Achievement with a measurable result — numbers beat adjectives.]</li><li>[Achievement — what you did, how, and the impact.]</li><li>[Achievement — shipped X, improved Y by Z%.]</li></ul><h3>[Job Title] — [Company]</h3><p><em>[Start] – [End] · [Location]</em></p><ul><li>[Achievement]</li><li>[Achievement]</li></ul><h2>Skills</h2><p><strong>Technical:</strong> [Skill, skill, skill, skill]</p><p><strong>Tools:</strong> [Tool, tool, tool]</p><h2>Education</h2><p><strong>[Degree]</strong> — [Institution], [Year]</p><p>[Honors, relevant coursework, or activities — optional.]</p>`,
  },
];

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}
