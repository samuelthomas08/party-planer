import { AdminOnly } from "@/components/settings/AdminOnly";
import { LiveLog } from "@/components/settings/LiveLog";

/** Route `/settings/logs` – live server log (admins). */
export default function Page() {
  return (
    <AdminOnly>
      <LiveLog />
    </AdminOnly>
  );
}
