import { Suspense } from "react";
import { AdminOnly } from "@/components/settings/AdminOnly";
import { AuditAdmin } from "@/components/settings/AuditAdmin";

/** Route `/settings/audit` – the complete audit log (admins). */
export default function Page() {
  return (
    <AdminOnly>
      <Suspense>
        <AuditAdmin />
      </Suspense>
    </AdminOnly>
  );
}
