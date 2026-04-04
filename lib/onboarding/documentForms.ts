export type DocType = "w4" | "i9" | "w9" | "direct_deposit" | "background_check" | "company_policy";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "checkbox" | "number";
  required: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
}

export interface DocumentFormDef {
  type: DocType;
  title: string;
  subtitle: string;
  description: string;
  fields: FieldDef[];
  displayOrder: number;
  defaultRequired: boolean;
}

export const DOCUMENT_FORM_DEFS: Record<DocType, DocumentFormDef> = {
  company_policy: {
    type: "company_policy",
    title: "Independent Contractor Agreement",
    subtitle: "Contractor terms & code of conduct",
    description:
      "By signing below you confirm you have read and agree to the independent contractor agreement, code of conduct, anti-harassment policy, and understand that you are engaged as a 1099 independent contractor, not an employee.",
    displayOrder: 0,
    defaultRequired: true,
    fields: [
      {
        key: "policy_ack",
        label: "I have read and agree to the independent contractor agreement and code of conduct",
        type: "checkbox",
        required: true,
      },
      {
        key: "contractor_ack",
        label: "I understand I am an independent contractor (1099) and am responsible for my own taxes, insurance, and benefits",
        type: "checkbox",
        required: true,
      },
      {
        key: "no_compete_ack",
        label: "I agree not to solicit or recruit current company contractors or clients for 12 months after separation",
        type: "checkbox",
        required: true,
      },
    ],
  },

  background_check: {
    type: "background_check",
    title: "Background Check Consent",
    subtitle: "Pre-employment screening authorization",
    description:
      "As a condition of employment, the company requires a background screening. Your consent authorizes the company and its designated agency to obtain a consumer report and/or investigative consumer report.",
    displayOrder: 1,
    defaultRequired: true,
    fields: [
      {
        key: "consent",
        label: "I authorize the company to conduct a background check as a condition of employment",
        type: "checkbox",
        required: true,
      },
      {
        key: "accurate_info",
        label: "I certify that all information I have provided is accurate and complete",
        type: "checkbox",
        required: true,
      },
    ],
  },

  w4: {
    type: "w4",
    title: "W-4 Employee's Withholding Certificate",
    subtitle: "Federal income tax withholding",
    description:
      "Complete this form so your employer can withhold the correct federal income tax from your pay. This information is for payroll purposes only and is kept confidential.",
    displayOrder: 2,
    defaultRequired: false,
    fields: [
      { key: "first_name",      label: "First Name & Middle Initial", type: "text",   required: true,  placeholder: "Jane A." },
      { key: "last_name",       label: "Last Name",                   type: "text",   required: true,  placeholder: "Smith" },
      { key: "address",         label: "Home Address",                type: "text",   required: true,  placeholder: "123 Main St" },
      { key: "city_state_zip",  label: "City, State, ZIP",            type: "text",   required: true,  placeholder: "Austin, TX 78701" },
      {
        key: "ssn_last4",
        label: "Last 4 digits of SSN",
        type: "text",
        required: true,
        placeholder: "XXXX",
        hint: "Only the last 4 digits are stored. Full SSN will be collected separately by payroll.",
      },
      {
        key: "filing_status",
        label: "Filing Status",
        type: "select",
        required: true,
        options: [
          "Single or Married filing separately",
          "Married filing jointly or Qualifying surviving spouse",
          "Head of household",
        ],
      },
      {
        key: "multiple_jobs",
        label: "I have more than one job or my spouse also works (Step 2 applies)",
        type: "checkbox",
        required: false,
      },
      {
        key: "extra_withholding",
        label: "Additional amount to withhold each pay period ($ — optional)",
        type: "number",
        required: false,
        placeholder: "0",
        hint: "Leave blank if no additional withholding.",
      },
    ],
  },

  i9: {
    type: "i9",
    title: "I-9 Employment Eligibility Verification",
    subtitle: "Section 1 — Employee information & attestation",
    description:
      "Federal law requires all employers to verify the identity and employment authorization of each person hired. Complete Section 1 by your first day of work. Your employer will complete Section 2 after reviewing your identity documents in person.",
    displayOrder: 3,
    defaultRequired: false,
    fields: [
      { key: "first_name",       label: "First Name",          type: "text",   required: true,  placeholder: "Jane" },
      { key: "middle_initial",   label: "Middle Initial",      type: "text",   required: false, placeholder: "A" },
      { key: "last_name",        label: "Last Name",           type: "text",   required: true,  placeholder: "Smith" },
      { key: "other_last_names", label: "Other Last Names Used", type: "text", required: false, placeholder: "Maiden name, etc." },
      { key: "address",          label: "Address",             type: "text",   required: true,  placeholder: "123 Main St" },
      { key: "city",             label: "City",                type: "text",   required: true,  placeholder: "Austin" },
      { key: "state",            label: "State",               type: "text",   required: true,  placeholder: "TX" },
      { key: "zip",              label: "ZIP Code",            type: "text",   required: true,  placeholder: "78701" },
      { key: "dob",              label: "Date of Birth",       type: "date",   required: true },
      {
        key: "ssn_last4",
        label: "Last 4 digits of SSN",
        type: "text",
        required: true,
        placeholder: "XXXX",
        hint: "Only the last 4 digits are stored.",
      },
      {
        key: "citizenship_status",
        label: "Citizenship / Immigration Status",
        type: "select",
        required: true,
        options: [
          "U.S. Citizen",
          "U.S. National",
          "Lawful Permanent Resident",
          "Alien Authorized to Work",
        ],
      },
      {
        key: "alien_reg_number",
        label: "Alien Registration / USCIS Number (if applicable)",
        type: "text",
        required: false,
        placeholder: "A-XXXXXXXXX",
      },
    ],
  },

  direct_deposit: {
    type: "direct_deposit",
    title: "Direct Deposit Authorization",
    subtitle: "Pay delivery preference",
    description:
      "Authorize your employer to deposit your earnings directly into your bank account. Attach a voided check or bank letter to confirm routing and account numbers.",
    displayOrder: 4,
    defaultRequired: true,
    fields: [
      { key: "bank_name",       label: "Bank Name",       type: "text",   required: true,  placeholder: "Chase Bank" },
      { key: "routing_number",  label: "Routing Number",  type: "text",   required: true,  placeholder: "9-digit ABA number" },
      { key: "account_number",  label: "Account Number",  type: "text",   required: true,  placeholder: "Your account number" },
      {
        key: "account_type",
        label: "Account Type",
        type: "select",
        required: true,
        options: ["Checking", "Savings"],
      },
      {
        key: "authorization",
        label: "I authorize my employer to initiate direct deposit entries to this account",
        type: "checkbox",
        required: true,
      },
    ],
  },

  w9: {
    type: "w9",
    title: "W-9 Request for Taxpayer Identification",
    subtitle: "For independent contractors (1099)",
    description:
      "Required if you are engaged as an independent contractor. Provides your taxpayer identification number for 1099 reporting.",
    displayOrder: 2,
    defaultRequired: true,
    fields: [
      { key: "name",             label: "Name (as shown on tax return)",   type: "text",   required: true,  placeholder: "Jane Smith" },
      { key: "business_name",    label: "Business Name / DBA (if any)",    type: "text",   required: false, placeholder: "Acme LLC" },
      {
        key: "tax_classification",
        label: "Federal Tax Classification",
        type: "select",
        required: true,
        options: [
          "Individual / Sole proprietor",
          "C Corporation",
          "S Corporation",
          "Partnership",
          "Trust / Estate",
          "LLC",
          "Other",
        ],
      },
      { key: "address",     label: "Address",          type: "text", required: true,  placeholder: "123 Main St" },
      { key: "city",        label: "City",             type: "text", required: true,  placeholder: "Austin" },
      { key: "state",       label: "State",            type: "text", required: true,  placeholder: "TX" },
      { key: "zip",         label: "ZIP Code",         type: "text", required: true,  placeholder: "78701" },
      {
        key: "ssn_or_ein",
        label: "SSN (last 4) or EIN",
        type: "text",
        required: true,
        placeholder: "XXXX or XX-XXXXXXX",
        hint: "For individuals: last 4 of SSN. For businesses: full EIN.",
      },
    ],
  },
};

// Default required set for 1099 independent contractor orgs.
// W-4 and I-9 are for W2 employees — available but not required by default.
export const DEFAULT_DOC_TYPES: DocType[] = [
  "company_policy",   // Independent Contractor Agreement
  "background_check",
  "w9",               // Taxpayer ID — required for 1099 reporting
  "direct_deposit",
  "w4",               // W2 only — seeded as not required
  "i9",               // W2 only — seeded as not required
];
