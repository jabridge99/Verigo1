interface Props {
  params: { token: string };
}

interface VerificationResult {
  program_id?: string;
  version: number;
  generated_at?: string;
  content_hash: string;
  item_count: number;
  is_current: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getVerification(token: string): Promise<VerificationResult | null> {
  try {
    const res = await fetch(`${API}/api/v1/verify/aml-program/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function VerifyAmlProgramPage({ params }: Props) {
  const result = await getVerification(params.token);

  if (!result) {
    return (
      <div className="min-h-screen bg-[#060d1a] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Verification Not Found</h1>
          <p className="text-slate-400">
            This verification token is unknown or invalid. If you scanned a QR code from a printed
            or exported document, the document may be outdated or fraudulent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060d1a] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-[#0d1526] p-8 space-y-6">
        <div className="text-center">
          <span className="text-lg font-bold">
            Veri<span className="text-blue-400">go</span>
          </span>
          <h1 className="text-xl font-bold mt-2">AML/CTF Program Verification</h1>
        </div>

        <div
          className={`rounded-lg px-4 py-3 text-center text-sm font-semibold ${
            result.is_current
              ? "bg-green-500/15 text-green-300 border border-green-500/30"
              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
          }`}
        >
          {result.is_current ? "Current Version" : "Superseded Version"}
        </div>

        <dl className="space-y-3 text-sm">
          {result.program_id && (
            <div className="flex justify-between">
              <dt className="text-slate-400">Program ID</dt>
              <dd className="font-mono">{result.program_id}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-400">Version</dt>
            <dd>{result.version}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Controls</dt>
            <dd>{result.item_count}</dd>
          </div>
          {result.generated_at && (
            <div className="flex justify-between">
              <dt className="text-slate-400">Generated</dt>
              <dd>{new Date(result.generated_at).toLocaleString()}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400 flex-shrink-0">Content Hash</dt>
            <dd className="font-mono text-xs break-all text-right">{result.content_hash}</dd>
          </div>
        </dl>

        <p className="text-xs text-slate-500 text-center pt-2 border-t border-slate-800">
          Verified by Verigo — this page confirms authenticity only. No program content is disclosed.
        </p>
      </div>
    </div>
  );
}
