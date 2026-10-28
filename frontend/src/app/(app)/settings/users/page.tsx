import { AdminOnly } from "@/components/settings/AdminOnly";
import { UsersAdmin } from "@/components/settings/UsersAdmin";

/** Route `/settings/users` – user management and invitations (admins). */
export default function Page() {
  return (
    <AdminOnly>
      <UsersAdmin />
    </AdminOnly>
  );
}
