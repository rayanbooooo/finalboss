import { ReferralCapture } from "@/components/affiliates/ReferralCapture";

/**
 * Landing target for a referral link. Records the code and sends the visitor
 * on to sign up; attribution happens once they actually have an account.
 */
export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ReferralCapture code={code} />;
}
