import { Suspense } from "react";
import { ResetPassword } from "@/auth/ResetPassword";

const Page = () => {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
};

export default Page;
