import CustomerPortal from "@/components/Onboarding/CustomerPortal";

interface Props {
  params: { token: string };
}

async function getPortalData(token: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/onboarding/portal/${token}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PortalPage({ params }: Props) {
  const data = await getPortalData(params.token);

  if (!data) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Link Invalid or Expired</h1>
          <p className="text-slate-400">This onboarding link is no longer valid. Please contact the business that sent you this link to request a new invitation.</p>
        </div>
      </div>
    );
  }

  return <CustomerPortal token={params.token} data={data} />;
}
