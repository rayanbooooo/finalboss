import { FundingForm } from "@/components/terminal/FundingForm";
import { FundingHistory } from "@/components/terminal/FundingHistory";

export default function WithdrawPage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <FundingForm mode="withdraw" />
      <div className="mx-auto mt-8 w-full max-w-3xl">
        <h2 className="mb-3 text-sm font-semibold text-white">Funding history</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <FundingHistory />
        </div>
      </div>
    </div>
  );
}
