import { Suspense } from "react";
import VerifyEmail from "@/auth/VerifyEmail";

const Page = () => {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
};

export default Page;
