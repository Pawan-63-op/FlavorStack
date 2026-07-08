import { Suspense } from "react";
import VerifyPhone from "@/auth/VerifyPhone";

const Page = () => (
  <Suspense fallback={null}>
    <VerifyPhone />
  </Suspense>
);

export default Page;
