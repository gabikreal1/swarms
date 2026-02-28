export interface OwaspCategory {
  id: string;
  name: string;
  description: string;
  criterionDescription: string;
  slitherDetectors: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  applicableTo: ('erc20' | 'erc721' | 'defi' | 'governance' | 'all')[];
}

export const OWASP_SMART_CONTRACT_TOP_10: OwaspCategory[] = [
  {
    id: 'SWC-107',
    name: 'Reentrancy',
    description: 'Functions that make external calls before updating state, allowing recursive callbacks to drain funds.',
    criterionDescription: 'All reentrancy vulnerabilities identified and documented, including cross-function and cross-contract reentrancy vectors.',
    slitherDetectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-101',
    name: 'Integer Overflow and Underflow',
    description: 'Arithmetic operations that wrap around on overflow/underflow, potentially causing unexpected behavior.',
    criterionDescription: 'All arithmetic operations checked for overflow/underflow vulnerabilities. Contracts using Solidity <0.8.0 verified for SafeMath usage.',
    slitherDetectors: ['divide-before-multiply'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-104',
    name: 'Unchecked Call Return Value',
    description: 'External calls whose return values are not checked, potentially silently failing.',
    criterionDescription: 'All external calls (low-level call, send, delegatecall) verified to check return values, with appropriate error handling.',
    slitherDetectors: ['unchecked-lowlevel', 'unchecked-send'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-105',
    name: 'Unprotected Ether Withdrawal',
    description: 'Functions that can send ETH/tokens to arbitrary addresses without proper access control.',
    criterionDescription: 'All functions involving value transfer verified to have proper access control. No unauthorized withdrawal paths exist.',
    slitherDetectors: ['arbitrary-send', 'arbitrary-send-erc20', 'arbitrary-send-erc20-permit'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-106',
    name: 'Unprotected SELFDESTRUCT',
    description: 'Contract self-destruction accessible by unauthorized parties.',
    criterionDescription: 'No unprotected selfdestruct/suicide calls. If selfdestruct exists, proper multi-sig or timelock protection verified.',
    slitherDetectors: ['suicidal'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-112',
    name: 'Delegatecall to Untrusted Callee',
    description: 'Using delegatecall with a user-controlled or upgradeable target can lead to complete contract takeover.',
    criterionDescription: 'All delegatecall usage verified to use trusted, immutable targets. Proxy patterns analyzed for upgrade safety.',
    slitherDetectors: ['controlled-delegatecall', 'delegatecall-loop'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-115',
    name: 'Authorization through tx.origin',
    description: 'Using tx.origin for authentication allows phishing attacks through intermediate contracts.',
    criterionDescription: 'No usage of tx.origin for authorization. All access control uses msg.sender or proper signature verification.',
    slitherDetectors: ['tx-origin'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-119',
    name: 'Shadowing State Variables',
    description: 'State variables in derived contracts that shadow base contract variables, leading to confusion and bugs.',
    criterionDescription: 'No shadowed state variables in inheritance chain. All variable names are unique across the contract hierarchy.',
    slitherDetectors: ['shadowing-state', 'shadowing-local', 'shadowing-abstract'],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-109',
    name: 'Uninitialized Storage Pointer',
    description: 'Uninitialized storage variables pointing to unexpected storage slots, potentially corrupting state.',
    criterionDescription: 'All storage variables properly initialized. No uninitialized structs or arrays used in storage context.',
    slitherDetectors: ['uninitialized-state', 'uninitialized-storage', 'uninitialized-local'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-116',
    name: 'Block Values as Proxy for Time',
    description: 'Using block.timestamp or block.number for critical logic that can be manipulated by miners.',
    criterionDescription: 'No critical logic (locking, vesting, randomness) relies on block.timestamp or block.number without tolerance thresholds.',
    slitherDetectors: ['timestamp'],
    severity: 'medium',
    applicableTo: ['defi', 'governance'],
  },
];

export const DEFI_COMPLIANCE_CRITERIA: OwaspCategory[] = [
  {
    id: 'DEFI-001',
    name: 'Sanctions Screening',
    description: 'Addresses interacting with the protocol checked against OFAC SDN list and other sanctions lists.',
    criterionDescription: 'Protocol implements or can integrate with on-chain sanctions checking. All deposit/withdrawal paths are screened.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-002',
    name: 'Oracle Manipulation',
    description: 'Price feeds can be manipulated via flash loans or low-liquidity attacks.',
    criterionDescription: 'All price oracle dependencies identified. TWAP, Chainlink, or multi-source oracles used. Flash loan attack vectors analyzed.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-003',
    name: 'Flash Loan Attack Vectors',
    description: 'Protocol logic can be exploited via single-transaction flash loan attacks.',
    criterionDescription: 'All state-changing functions analyzed for flash loan attack vectors. No single-block manipulation possible for critical operations.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-004',
    name: 'Governance Centralization Risk',
    description: 'Admin/owner keys have excessive control over protocol funds or parameters.',
    criterionDescription: 'All admin functions catalogued with risk assessment. Timelock and multi-sig requirements documented. No single key can drain funds.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['defi', 'governance'],
  },
  {
    id: 'DEFI-005',
    name: 'Liquidity and TVL Risk',
    description: 'Protocol risk assessment based on TVL concentration, impermanent loss exposure, and liquidity depth.',
    criterionDescription: 'TVL concentration risk analyzed. Impermanent loss scenarios modeled. Liquidity withdrawal scenarios stress-tested.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-006',
    name: 'Regulatory Compliance',
    description: 'Protocol compliance with applicable regulations (MiCA, US securities law, etc.).',
    criterionDescription: 'Token classification analyzed (utility vs security). Applicable regulatory frameworks identified. KYC/AML integration points documented.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['defi'],
  },
];

/**
 * Get criteria relevant to a specific contract type.
 */
export function getCriteriaForContract(
  contractTypes: string[],
  includeDefi: boolean = false,
): OwaspCategory[] {
  const types = new Set(contractTypes.map(t => t.toLowerCase()));
  types.add('all');

  let criteria = OWASP_SMART_CONTRACT_TOP_10.filter(
    c => c.applicableTo.some(a => types.has(a)),
  );

  if (includeDefi) {
    const defi = DEFI_COMPLIANCE_CRITERIA.filter(
      c => c.applicableTo.some(a => types.has(a)),
    );
    criteria = [...criteria, ...defi];
  }

  return criteria;
}

/**
 * Map a Slither detector name to an OWASP SWC category ID.
 */
export function mapDetectorToSWC(detector: string): string {
  const all = [...OWASP_SMART_CONTRACT_TOP_10, ...DEFI_COMPLIANCE_CRITERIA];
  for (const cat of all) {
    if (cat.slitherDetectors.includes(detector)) return cat.id;
  }
  return 'SWC-000';
}
