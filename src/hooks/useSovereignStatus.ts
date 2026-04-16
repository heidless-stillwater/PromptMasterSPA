import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { accDb } from '../lib/firebase';

export interface SovereignStatus {
  isGated: boolean;
  overallStatus: 'green' | 'amber' | 'red';
  failingPolicies: string[];
  lastAudit: Date | null;
}

/**
 * Sovereign Sentinel Hook (PromptMasterSPA)
 * Provides real-time synchronization with the Accreditation Registry.
 */
export function useSovereignStatus() {
  const [status, setStatus] = useState<SovereignStatus>({
    isGated: false,
    overallStatus: 'green',
    failingPolicies: [],
    lastAudit: null,
  });

  useEffect(() => {
    console.log('[useSovereignStatus] Connecting_to_Sovereign_Registry...');
    
    // Monitor all policies in the suite
    const q = query(collection(accDb, 'policies'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const policies = snapshot.docs.map(doc => doc.data());
      const failing = policies.filter(p => p.status === 'red');
      
      const isGated = failing.length > 0;
      let overall: 'green' | 'amber' | 'red' = 'green';
      
      if (isGated) overall = 'red';
      else if (policies.some(p => p.status === 'amber')) overall = 'amber';

      setStatus({
        isGated,
        overallStatus: overall,
        failingPolicies: failing.map(p => p.name || p.slug),
        lastAudit: new Date()
      });
      
      if (isGated) {
        console.warn(`[Sentinel] SOVEREIGN_GATE_ACTIVE: ${failing.length} policy drifts detected.`);
      }
    }, (error) => {
      console.error('[useSovereignStatus] Registry Connection Failed:', error);
    });

    return () => unsubscribe();
  }, []);

  return status;
}
