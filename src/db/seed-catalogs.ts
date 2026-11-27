export type RegionSeed = {
  id: string;
  name: string;
  code: string;
  states: string[];
  manager: { name: string; email: string; title: string };
};

export const REGIONS: RegionSeed[] = [
  {
    id: "south-west",
    name: "South West",
    code: "SW",
    states: ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"],
    manager: { name: "Emeka Obi", email: "regional@crunchiesfood.com", title: "Regional Manager, South West" },
  },
  {
    id: "north-central",
    name: "North Central",
    code: "NC",
    states: ["FCT", "Kogi", "Plateau", "Benue", "Kwara", "Nasarawa", "Niger"],
    manager: { name: "Aisha Danjuma", email: "aisha.danjuma@crunchiesfood.com", title: "Regional Manager, North Central" },
  },
  {
    id: "south-east",
    name: "South East",
    code: "SE",
    states: ["Enugu", "Anambra", "Imo", "Abia", "Ebonyi"],
    manager: { name: "Ifeanyi Ude", email: "ifeanyi.ude@crunchiesfood.com", title: "Regional Manager, South East" },
  },
  {
    id: "south-south",
    name: "South South",
    code: "SS",
    states: ["Rivers", "Delta", "Akwa Ibom", "Edo", "Cross River", "Bayelsa"],
    manager: { name: "Preye Tamuno", email: "preye.tamuno@crunchiesfood.com", title: "Regional Manager, South South" },
  },
  {
    id: "north-west",
    name: "North West",
    code: "NW",
    states: ["Kano", "Kaduna", "Katsina", "Kebbi", "Sokoto", "Zamfara", "Jigawa"],
    manager: { name: "Sani Garba", email: "sani.garba@crunchiesfood.com", title: "Regional Manager, North West" },
  },
  {
    id: "north-east",
    name: "North East",
    code: "NE",
    states: ["Bauchi", "Adamawa", "Borno", "Gombe", "Taraba", "Yobe"],
    manager: { name: "Adamu Bukar", email: "adamu.bukar@crunchiesfood.com", title: "Regional Manager, North East" },
  },
];

export const OUTLETS = [
  { code: "CRN-LAG-001", name: "Ikeja City Mall", state: "Lagos", region: "south-west", address: "Ikeja City Mall, Alausa, Ikeja, Lagos", employees: 38, risk: "high" },
  { code: "CRN-LAG-002", name: "Lekki Phase 1", state: "Lagos", region: "south-west", address: "Admiralty Way, Lekki Phase 1, Lagos", employees: 32, risk: "medium" },
  { code: "CRN-LAG-003", name: "Surulere", state: "Lagos", region: "south-west", address: "Bode Thomas Road, Surulere, Lagos", employees: 27, risk: "critical" },
  { code: "CRN-LAG-004", name: "Yaba", state: "Lagos", region: "south-west", address: "Herbert Macaulay Way, Yaba, Lagos", employees: 25, risk: "high" },
  { code: "CRN-OYO-001", name: "Ibadan Ring Road", state: "Oyo", region: "south-west", address: "Ring Road, Ibadan, Oyo", employees: 29, risk: "medium" },
  { code: "CRN-OGU-001", name: "Abeokuta Oke-Ilewo", state: "Ogun", region: "south-west", address: "Oke-Ilewo, Abeokuta, Ogun", employees: 22, risk: "low" },
  { code: "CRN-OND-001", name: "Akure Alagbaka", state: "Ondo", region: "south-west", address: "Alagbaka Estate, Akure, Ondo", employees: 19, risk: "medium" },
  { code: "CRN-OSU-001", name: "Osogbo Old Garage", state: "Osun", region: "south-west", address: "Old Garage, Osogbo, Osun", employees: 18, risk: "high" },
  { code: "CRN-FCT-001", name: "Abuja Wuse II", state: "FCT", region: "north-central", address: "Adetokunbo Ademola Crescent, Wuse II, Abuja", employees: 35, risk: "medium" },
  { code: "CRN-FCT-002", name: "Abuja Garki", state: "FCT", region: "north-central", address: "Ahmadu Bello Way, Garki, Abuja", employees: 30, risk: "high" },
  { code: "CRN-KOG-001", name: "Lokoja Ganaja", state: "Kogi", region: "north-central", address: "Ganaja Road, Lokoja, Kogi", employees: 17, risk: "low" },
  { code: "CRN-PLA-001", name: "Jos Bukuru", state: "Plateau", region: "north-central", address: "Bukuru Expressway, Jos, Plateau", employees: 21, risk: "critical" },
  { code: "CRN-BEN-001", name: "Makurdi High Level", state: "Benue", region: "north-central", address: "High Level, Makurdi, Benue", employees: 16, risk: "medium" },
  { code: "CRN-ENU-001", name: "Enugu Independence Layout", state: "Enugu", region: "south-east", address: "Independence Layout, Enugu", employees: 24, risk: "high" },
  { code: "CRN-ANA-001", name: "Onitsha Main Market", state: "Anambra", region: "south-east", address: "Main Market, Onitsha, Anambra", employees: 28, risk: "critical" },
  { code: "CRN-ANA-002", name: "Awka Zik Avenue", state: "Anambra", region: "south-east", address: "Zik Avenue, Awka, Anambra", employees: 20, risk: "medium" },
  { code: "CRN-IMO-001", name: "Owerri Wetheral", state: "Imo", region: "south-east", address: "Wetheral Road, Owerri, Imo", employees: 22, risk: "high" },
  { code: "CRN-RIV-001", name: "Port Harcourt GRA", state: "Rivers", region: "south-south", address: "GRA Phase 2, Port Harcourt, Rivers", employees: 31, risk: "high" },
  { code: "CRN-AKW-001", name: "Uyo Ibom Plaza", state: "Akwa Ibom", region: "south-south", address: "Ibom Plaza, Uyo, Akwa Ibom", employees: 23, risk: "medium" },
  { code: "CRN-EDO-001", name: "Benin City Airport Road", state: "Edo", region: "south-south", address: "Airport Road, Benin City, Edo", employees: 26, risk: "critical" },
  { code: "CRN-DEL-001", name: "Warri Effurun", state: "Delta", region: "south-south", address: "Effurun, Warri, Delta", employees: 21, risk: "medium" },
  { code: "CRN-KAN-001", name: "Kano Nassarawa", state: "Kano", region: "north-west", address: "Nassarawa GRA, Kano", employees: 27, risk: "high" },
  { code: "CRN-KAD-001", name: "Kaduna Central", state: "Kaduna", region: "north-west", address: "Ahmadu Bello Way, Kaduna", employees: 24, risk: "medium" },
  { code: "CRN-BAU-001", name: "Bauchi Central", state: "Bauchi", region: "north-east", address: "Ran Road, Bauchi", employees: 18, risk: "low" },
] as const;

export const OUTLET_MANAGERS = [
  "Kemi Alabi",
  "Chinedu Okafor",
  "Fatima Sani",
  "Segun Adebayo",
  "Blessing Uche",
  "Musa Ibrahim",
  "Funmi Ojo",
  "Kelechi Nwosu",
  "Aisha Bello",
  "David Eze",
  "Yemi Ogunleye",
  "Ngozi Okeke",
  "Sadiq Yusuf",
  "Bola Adeleke",
  "Ifeoma Nnaji",
  "Tunde Bakare",
  "Hauwa Mohammed",
  "Chika Obi",
  "Femi Ajayi",
  "Zainab Lawal",
  "Peter Etim",
  "Amaka Onyeka",
  "Gbenga Salami",
  "Rukayat Adeniyi",
];

export const ASSISTANT_MANAGERS = [
  "Ada Uche", "Jide Ojo", "Maryam Sule", "Emeka Nwafor", "Titi Ade", "Sani Umar",
  "Chinwe Obi", "Bayo Alao", "Halima Bala", "Ifeanyi Eze", "Ronke Ade", "Kabiru Musa",
  "Uche Nnamdi", "Yinka Ola", "Zara Ahmed", "Chidi Kalu", "Martha Peter", "Kelvin Ode",
  "Amina Garba", "Dapo Ajayi", "Nneka Onu", "Wale Ojo", "Aisha Sani", "Efe Akpore",
];

export const AUDITORS = [
  { name: "Tolu Ajayi", email: "auditor@crunchiesfood.com", title: "Internal Auditor" },
  { name: "Chidi Umeh", email: "chidi.umeh@crunchiesfood.com", title: "Senior Internal Auditor" },
  { name: "Halima Abubakar", email: "halima.abubakar@crunchiesfood.com", title: "Internal Auditor" },
  { name: "Victor Ekpo", email: "victor.ekpo@crunchiesfood.com", title: "Internal Auditor" },
  { name: "Nneka Achebe", email: "nneka.achebe@crunchiesfood.com", title: "Senior Internal Auditor" },
  { name: "Bashir Musa", email: "bashir.musa@crunchiesfood.com", title: "Internal Auditor" },
  { name: "Dayo Fashola", email: "dayo.fashola@crunchiesfood.com", title: "Internal Auditor" },
  { name: "Rita Ogbonna", email: "rita.ogbonna@crunchiesfood.com", title: "Internal Auditor" },
];

type CatalogItem = {
  section: string;
  items: [string, string?, string?, string?][];
};

export const TEMPLATE_CATALOGS: Record<
  string,
  { code: string; name: string; description: string; sections: CatalogItem[] }
> = {
  financial: {
    code: "TPL-FIN",
    name: "Financial & Cash Management Audit",
    description: "Cash, sales reconciliation, banking, refunds, discounts and expense controls.",
    sections: [
      {
        section: "Sales reconciliation",
        items: [
          ["Daily sales report is reconciled to the POS Z-report and bank deposit.", "high", "document"],
          ["Cash sales agree to POS card and transfer settlements for the period.", "critical"],
          ["Bank deposits are made intact and on the next business day.", "critical", "document"],
          ["Sales per system reports agree to physical cash counts and bank statements.", "high", "document"],
        ],
      },
      {
        section: "Cash and expenses",
        items: [
          ["Cash shortages and overages are investigated and approved.", "critical", "document"],
          ["Cashier floats and accountability sheets are maintained for every shift.", "medium"],
          ["Petty cash is held on an approved imprest and reconciled.", "medium", "document"],
          ["Expenses are supported by approved receipts and documentation.", "medium", "document"],
        ],
      },
      {
        section: "Transactions and handover",
        items: [
          ["Refunds and void transactions are approved by an authorised manager.", "critical"],
          ["Discounts and promotional transactions are applied within approved limits.", "medium"],
          ["Unauthorised transactions are identified, documented and cleared.", "high"],
          ["Cash handover procedures are followed and documented at shift change.", "medium", "document"],
          ["Daily sales reports are signed by the outlet manager.", "medium", "document"],
        ],
      },
    ],
  },
  inventory: {
    code: "TPL-INV",
    name: "Inventory & Stock Audit",
    description: "Stock records, physical counts, variances, wastage, storekeeping and valuations.",
    sections: [
      {
        section: "Stock records",
        items: [
          ["Opening stock records agree to the prior period closing stock.", "high", "document"],
          ["Purchases received are supported by a goods received note and supplier invoice.", "high", "document"],
          ["Stock transfers between outlets are approved and documented.", "medium"],
          ["Stock issues are recorded and authorised.", "medium"],
          ["Closing stock is counted, valued and signed by the outlet manager.", "high", "document"],
        ],
      },
      {
        section: "Physical verification",
        items: [
          ["The physical stock count is performed by an independent count team.", "high", "document"],
          ["System stock agrees to the physical stock count.", "critical", "document", "numeric"],
          ["Expired products are segregated and removed from saleable stock.", "high", "document"],
          ["Damaged goods are recorded and approved for disposal.", "medium"],
        ],
      },
      {
        section: "Losses and storekeeping",
        items: [
          ["Wastage and stock losses are documented and approved.", "medium", "document"],
          ["Stock adjustments are authorised and supported by evidence.", "critical"],
          ["Stock variances are investigated and resolved.", "critical", "document"],
          ["Storekeeping practices protect stock from loss, contamination and damage.", "medium"],
          ["Stock documentation is complete, accurate and filed.", "medium", "document"],
        ],
      },
    ],
  },
  procurement: {
    code: "TPL-PRC",
    name: "Procurement & Purchasing Audit",
    description: "Requisitions, approvals, supplier verification, invoices and payment documentation.",
    sections: [
      {
        section: "Requisition and approval",
        items: [
          ["Purchase requisitions are raised and approved before ordering.", "high", "document"],
          ["Purchase approvals are within delegated limits.", "high"],
          ["Purchase orders are raised before goods or services are supplied.", "high", "document"],
          ["There are no unauthorised purchases.", "critical"],
        ],
      },
      {
        section: "Supplier and invoice controls",
        items: [
          ["Suppliers are verified and approved before onboarding.", "high"],
          ["Price comparisons are obtained for significant purchases.", "medium", "document"],
          ["Supplier invoices are supported by purchase orders and goods received notes.", "high", "document"],
          ["Duplicate invoices are identified and prevented.", "critical"],
        ],
      },
      {
        section: "Policy and payments",
        items: [
          ["Procurement policy and approval thresholds are complied with.", "high"],
          ["Supplier payment documentation is complete and authorised.", "high", "document"],
        ],
      },
    ],
  },
  operational: {
    code: "TPL-OPS",
    name: "Operational Audit",
    description: "Operating procedures, food quality, hygiene, staffing and service standards.",
    sections: [
      {
        section: "Procedures and quality",
        items: [
          ["Operational procedures are followed by all staff on duty.", "high"],
          ["Food preparation procedures meet the standard recipe and timing.", "high"],
          ["Product quality meets brand and customer standards.", "high"],
          ["Equipment is maintained and in working condition.", "medium"],
        ],
      },
      {
        section: "People and service",
        items: [
          ["Customer service standards are consistently applied.", "medium"],
          ["Staff attendance records agree to the duty roster.", "medium"],
          ["Staff wear the approved uniform and maintain personal hygiene.", "medium"],
          ["Management supervision is present throughout trading hours.", "high"],
        ],
      },
      {
        section: "Premises and efficiency",
        items: [
          ["Hygiene and sanitation standards are maintained in all areas.", "high", "document"],
          ["Opening and closing procedures are completed and signed.", "medium", "document"],
          ["Operational efficiency targets are monitored and met.", "low"],
        ],
      },
    ],
  },
  it: {
    code: "TPL-IT",
    name: "IT & Technology Audit",
    description: "POS integrity, connectivity, CCTV, access control, backups and downtime records.",
    sections: [
      {
        section: "POS and connectivity",
        items: [
          ["POS terminals are available and functional during trading hours.", "high"],
          ["POS transaction integrity is assured and sequence gaps are investigated.", "critical", "document"],
          ["Network and internet availability meet operational requirements.", "high"],
          ["Router and connectivity status are monitored and logged.", "medium"],
          ["System downtime is recorded and reported.", "medium", "document"],
        ],
      },
      {
        section: "CCTV and devices",
        items: [
          ["CCTV cameras are functional and cover cash and service areas.", "high", "document"],
          ["NVR/DVR recording is available for the required retention period.", "high", "document"],
          ["CCTV recordings are backed up and access is controlled.", "medium"],
          ["Computers and printers are in good working condition.", "low"],
        ],
      },
      {
        section: "Access and data",
        items: [
          ["User access permissions are appropriate to job roles.", "high"],
          ["Password management practices are secure.", "high"],
          ["Unauthorised system access is prevented and monitored.", "critical", "document"],
          ["Backup procedures are performed and tested.", "high", "document"],
          ["Data integrity across POS and back-office reports is maintained.", "high"],
        ],
      },
    ],
  },
  hr: {
    code: "TPL-HR",
    name: "Human Resources & Payroll Audit",
    description: "Staff records, attendance, payroll, overtime, transfers and HR policy compliance.",
    sections: [
      {
        section: "Staff records and attendance",
        items: [
          ["Staff attendance records are complete and accurate.", "high", "document"],
          ["Staff files contain contracts, identification and required documents.", "medium", "document"],
          ["New employee documentation is complete before commencement.", "medium"],
          ["Resignation and termination records are properly maintained.", "medium"],
        ],
      },
      {
        section: "Payroll controls",
        items: [
          ["Payroll is accurate and agrees to approved staff records.", "high", "document"],
          ["Overtime is approved before payment.", "high"],
          ["Unauthorised staff payments are prevented and investigated.", "high"],
          ["Staff transfers are approved and documented.", "medium"],
        ],
      },
      {
        section: "Policy and scheduling",
        items: [
          ["Staff scheduling meets operational requirements and labour rules.", "medium"],
          ["HR policies are complied with and acknowledged by staff.", "medium", "document"],
        ],
      },
    ],
  },
  asset: {
    code: "TPL-AST",
    name: "Asset Management Audit",
    description: "Asset register, verification, condition, serial numbers, assignment and movement.",
    sections: [
      {
        section: "Register and verification",
        items: [
          ["The equipment register is complete and up to date.", "high", "document"],
          ["Physical assets agree to the asset register.", "high", "document"],
          ["Serial numbers are recorded and verified.", "medium", "document"],
          ["Purchase documentation is available for significant assets.", "medium", "document"],
        ],
      },
      {
        section: "Condition and assignment",
        items: [
          ["Assets are in good condition and fit for use.", "medium"],
          ["Warranty status is known and claims are managed.", "low", "document"],
          ["Assets are assigned to responsible staff and locations.", "medium"],
          ["Missing assets are investigated and reported.", "critical"],
          ["Damaged equipment is recorded and repaired or written off.", "medium"],
        ],
      },
      {
        section: "Movement",
        items: [
          ["Unauthorised asset movement is prevented and monitored.", "high"],
        ],
      },
    ],
  },
  compliance: {
    code: "TPL-CMP",
    name: "Regulatory & Compliance Audit",
    description: "Food safety, fire safety, permits, tax, regulatory inspections and certifications.",
    sections: [
      {
        section: "Safety",
        items: [
          ["Food safety requirements are met and documented.", "critical", "document"],
          ["Fire safety equipment is available, serviced and accessible.", "critical", "document"],
          ["Health and safety practices protect staff and customers.", "high"],
          ["Environmental compliance requirements are met.", "medium", "document"],
        ],
      },
      {
        section: "Permits and tax",
        items: [
          ["Business permits and licences are valid and displayed.", "critical", "document"],
          ["Tax documentation is complete and up to date.", "medium", "document"],
          ["Required certificates and renewals are current.", "high", "document"],
          ["Regulatory inspection findings are closed.", "high"],
        ],
      },
      {
        section: "Internal compliance",
        items: [
          ["Internal policies are understood and complied with.", "medium"],
          ["Compliance training is completed by required staff.", "low", "document"],
        ],
      },
    ],
  },
};
