import { AdminOnly } from "@/components/settings/AdminOnly";
import { SystemSettings } from "@/components/settings/SystemSettings";

/** Route `/settings/system` – system settings (admins). */
export default function Page() {
  return (
    <AdminOnly>
      <SystemSettings />
    </AdminOnly>
  );
}
