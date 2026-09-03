import { OrderProcessingWrapper } from "@/components/pages/OrderProcessingWrapper";
import { Suspense } from "react";

// `OrderProcessingWrapper` reads `useSearchParams()`, which suspends during prerender.
// Without this boundary the whole route deopts to client-side rendering (and older
// Next versions fail the build outright) — same pattern as `app/(components)/login/page.tsx`.
const Page = () => {
  return (
    <div>
      <Suspense fallback={null}>
        <OrderProcessingWrapper />
      </Suspense>
    </div>
  )
}

export default Page
