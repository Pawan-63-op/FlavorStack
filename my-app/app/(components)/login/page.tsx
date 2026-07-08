import { Suspense } from "react";
import { Login } from "@/auth/Login";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
