import { RestaurantListWrapper } from "@/components/pages/RestaurantListWrapper";
import { Suspense } from "react";

// `RestaurantListWrapper` reads `useSearchParams()` — see the note in
// `app/(protected)/order-processing/page.tsx`.
const page = () => {
  return (
    <div>
      <Suspense fallback={null}>
        <RestaurantListWrapper />
      </Suspense>
    </div>
  )
}

export default page
