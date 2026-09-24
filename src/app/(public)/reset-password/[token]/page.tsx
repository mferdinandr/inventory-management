import { ResetForm } from "./reset-form"

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <ResetForm token={token} />
    </main>
  )
}
