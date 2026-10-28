import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { IconLink } from "../ui/Button";

/** Page title with a back button and optional actions. */
export function PageHeader({
  title,
  backHref = "/",
  backLabel,
  actions,
}: {
  title: string;
  backHref?: string;
  backLabel: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-1">
      <IconLink href={backHref} label={backLabel} className="-ml-2">
        <ArrowLeft className="size-5" />
      </IconLink>
      <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold tracking-tight">{title}</h1>
      {actions}
    </div>
  );
}
