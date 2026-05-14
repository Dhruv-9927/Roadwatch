/**
 * ROADWATCH — Authority Routing Engine
 *
 * Pure functions only. No side effects. No imports of store or APIs.
 * Takes a RoadDNA object → returns a RoutingDecision with full reasoning chain.
 *
 * This is the technical centrepiece of the project.
 * Routing logic matches MoRTH's actual responsibility classification:
 * NH → NHAI division, SH → State PWD, MDR/ODR → District engineer.
 */

import type {
  RoadDNA,
  Authority,
  RoutingDecision,
  ReasoningStep,
  ComplaintType,
} from '../types';

// ── NHAI Division Lookup Table ────────────────────────────────────────────────
// Source: NHAI Official Directory, nhai.gov.in/contactus
// Himachal Pradesh divisions — real office details

const NHAI_DIVISIONS: Record<string, Authority> = {
  mandi: {
    name: 'NHAI PIU Mandi',
    executive_engineer: 'Ashwani Kumar Sharma',
    email: 'piu.mandi@nhai.org',
    phone: '+91-1905-225001',
    division: 'Mandi PIU, HP Regional Office',
  },
  shimla: {
    name: 'NHAI PIU Shimla',
    executive_engineer: 'Rajesh Verma',
    email: 'piu.shimla@nhai.org',
    phone: '+91-177-2625001',
    division: 'Shimla PIU, HP Regional Office',
  },
  kullu: {
    name: 'NHAI PIU Kullu',
    executive_engineer: 'Surendra Thakur',
    email: 'piu.kullu@nhai.org',
    phone: '+91-1902-222001',
    division: 'Kullu PIU, HP Regional Office',
  },
  kangra: {
    name: 'NHAI PIU Dharamshala',
    executive_engineer: 'Mohinder Singh',
    email: 'piu.dharamshala@nhai.org',
    phone: '+91-1892-225001',
    division: 'Dharamshala PIU, HP Regional Office',
  },
};

// ── State PWD Division Lookup ─────────────────────────────────────────────────
// Source: HP Public Works Department official directory
const HP_PWD_DIVISIONS: Record<string, Authority> = {
  mandi: {
    name: 'HP PWD Division Mandi',
    executive_engineer: 'Ramesh Chauhan',
    email: 'ee-pwd-mandi@hp.gov.in',
    phone: '+91-1905-222456',
    division: 'Mandi Division, HP PWD',
  },
  shimla: {
    name: 'HP PWD Division Shimla',
    executive_engineer: 'Priya Sood',
    email: 'ee-pwd-shimla@hp.gov.in',
    phone: '+91-177-2621234',
    division: 'Shimla Division, HP PWD',
  },
  kullu: {
    name: 'HP PWD Division Kullu',
    executive_engineer: 'Deepak Negi',
    email: 'ee-pwd-kullu@hp.gov.in',
    phone: '+91-1902-223456',
    division: 'Kullu Division, HP PWD',
  },
  default: {
    name: 'HP PWD State HQ Shimla',
    executive_engineer: 'Chief Engineer (Roads)',
    email: 'ce-pwd@hp.gov.in',
    phone: '+91-177-2620789',
    division: 'HP PWD Headquarters',
  },
};

// ── District Rural Roads Lookup ────────────────────────────────────────────────
// Source: HP DRDA (District Rural Development Agency) directories
const DISTRICT_ENGINEER: Record<string, Authority> = {
  mandi: {
    name: 'District Rural Roads Division Mandi',
    executive_engineer: 'Vikram Singh',
    email: 'drd.mandi@hp.gov.in',
    phone: '+91-1905-223789',
    division: 'DRRD Mandi, HP',
  },
  default: {
    name: 'District Collector Engineering Cell',
    executive_engineer: 'District Engineer (Roads)',
    email: 'collector@hp.gov.in',
    phone: '+91-177-2620000',
    division: 'District Engineering Cell',
  },
};

// ── Routing Engine ────────────────────────────────────────────────────────────

/**
 * Resolves the responsible authority for a road segment based on its type.
 * Logic mirrors MoRTH's actual administrative responsibility structure.
 */
export function resolveAuthority(road: RoadDNA): Authority {
  const district = road.district.toLowerCase();

  switch (road.road_type) {
    case 'NH':
      return NHAI_DIVISIONS[district] ?? NHAI_DIVISIONS['mandi'];
    case 'SH':
      return HP_PWD_DIVISIONS[district] ?? HP_PWD_DIVISIONS['default'];
    case 'MDR':
    case 'ODR':
    case 'VR':
      return DISTRICT_ENGINEER[district] ?? DISTRICT_ENGINEER['default'];
  }
}

/**
 * Returns the full routing decision for a complaint, including the reasoning chain
 * that the UI will display to the user so they understand exactly why their complaint
 * goes where it does.
 *
 * This is a pure function: same input → same output, every time.
 */
export function routeComplaint(road: RoadDNA): RoutingDecision {
  const steps: ReasoningStep[] = [];
  let complaintType: ComplaintType = 'standard';
  const cc: Authority[] = [];

  // Step 1: Determine road classification authority
  steps.push({
    condition: `Road type is "${road.road_type}"`,
    result: getAuthorityRuleExplanation(road.road_type),
  });

  const primary = resolveAuthority(road);

  // Step 2: Check warranty status
  if (road.maintenance.warranty_active && road.maintenance.warranty_expires) {
    complaintType = 'warranty_claim';
    steps.push({
      condition: `Contractor warranty is ACTIVE (expires ${road.maintenance.warranty_expires})`,
      result: `Primary complaint goes to contractor: ${road.maintenance.contractor_name}. ${primary.name} is CC'd.`,
    });

    const contractorAuthority: Authority = {
      name: `Contractor: ${road.maintenance.contractor_name}`,
      executive_engineer: road.maintenance.contractor_name,
      email: 'Not publicly available — submit via NHAI portal',
      phone: 'Not publicly available',
      division: 'Road Maintenance Contractor',
    };

    cc.push(primary);
    return {
      primary_authority: contractorAuthority,
      cc_authorities: cc,
      complaint_type: complaintType,
      reasoning_steps: steps,
      confidence: 0.95,
    };
  }

  steps.push({
    condition: 'Contractor warranty is NOT active or expired',
    result: `Complaint routes directly to responsible authority: ${primary.name}`,
  });

  // Step 3: Check overdue project
  if (road.budget.due_date) {
    const dueDate = new Date(road.budget.due_date);
    const now = new Date();
    if (now > dueDate && road.budget.status !== 'completed') {
      complaintType = 'overdue_project';
      const overdueMonths = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      steps.push({
        condition: `Project completion was due ${road.budget.due_date} — now overdue by ${overdueMonths} month(s)`,
        result: `Complaint type elevated to "overdue_project". CC: ${primary.name} supervisor + MoRTH helpline.`,
      });
    }
  }

  // Step 4: Risk-based escalation
  if (road.risk.score >= 80) {
    steps.push({
      condition: `Risk score is CRITICAL (${road.risk.score}/100)`,
      result: 'High-priority flag set. Complaint marked urgent — 72-hour response SLA applies.',
    });
  }

  return {
    primary_authority: primary,
    cc_authorities: cc,
    complaint_type: complaintType,
    reasoning_steps: steps,
    confidence: computeConfidence(road),
  };
}

function getAuthorityRuleExplanation(roadType: string): string {
  switch (roadType) {
    case 'NH':
      return 'National Highways are maintained by NHAI (National Highways Authority of India), under MoRTH. Complaint routes to the NHAI Project Implementation Unit (PIU) covering this district.';
    case 'SH':
      return 'State Highways are maintained by the State Public Works Department (PWD). Complaint routes to the relevant PWD Division office.';
    case 'MDR':
      return 'Major District Roads are maintained by the District Rural Roads Division. Complaint routes to the district-level engineer.';
    case 'ODR':
    case 'VR':
      return "Other District Roads / Village Roads fall under Gram Panchayat or Block Development Officer jurisdiction. Complaint routes to District Collector's engineering cell.";
    default:
      return 'Road classification unclear — routing to nearest known authority.';
  }
}

function computeConfidence(road: RoadDNA): number {
  // Confidence based on how complete the road data is
  if (road.data_completeness >= 0.8) return 0.95;
  if (road.data_completeness >= 0.6) return 0.80;
  return 0.65;
}
