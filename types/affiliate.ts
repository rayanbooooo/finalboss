export interface AffiliateTier {
  id: string;
  name: string;
  requirement: string;
  commissionPct: number;
  perks: string[];
  recommended?: boolean;
}
