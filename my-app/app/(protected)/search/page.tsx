import { DynamicSearch } from "@/components/DynamicSearch";
import { Suspense } from "react";

export default function SearchPage() {
  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <DynamicSearch />
      </Suspense>
    </div>
  );
}