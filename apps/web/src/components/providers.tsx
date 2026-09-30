import { Toaster } from "@forkhub/ui/components/sonner";

// Public site is static + dark-only (t3.codes design): no next-themes,
// no react-query provider. The OSS catalog is a static import, not RPC,
// so forkhub.imbios.dev works with zero backend.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors />
    </>
  );
}
