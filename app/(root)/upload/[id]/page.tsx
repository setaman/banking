import { getUploadResult } from "@/app/upload.actions";
import Dashboard from "@/src/components/Dashboard/Dashboard";
import Transactions from "@/src/components/Transactions";

export default async function UploadResult({
  params,
}: {
  params: { id: string };
}) {
  const stats = await getUploadResult(params.id);

  return (
    <>
      {stats && (
        <>
          <Dashboard stats={stats} />
          <div className="mt-16">
            <Transactions transactions={stats?.transactionsByMonth ?? []} />
          </div>
        </>
      )}
    </>
  );
}
