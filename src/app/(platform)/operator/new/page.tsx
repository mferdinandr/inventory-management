import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { CreateOrganizationForm } from "@/components/operator/organization-form"
import { DEFAULT_QUOTA } from "@/lib/validators/organization"
import { requirePlatformOwner } from "@/server/tenant"

export default async function NewOrganizationPage() {
  await requirePlatformOwner()
  return (
    <div className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <Link
          href="/operator"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Organisasi
        </Link>
        <h1 className="text-xl font-semibold">Buat Organisasi Pelanggan</h1>
      </header>
      <CreateOrganizationForm
        defaults={{
          status: "TRIAL",
          quotaAssets: DEFAULT_QUOTA.assets,
          quotaStorageGb: DEFAULT_QUOTA.storageGb,
          quotaUsers: DEFAULT_QUOTA.users,
        }}
      />
    </div>
  )
}
