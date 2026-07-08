/**
 * Seeded verified-customer credentials for the auth E2E suite.
 *
 * Real values come from `e2e/.env` (gitignored — see `e2e/README.md`); the
 * defaults match the documented local fixture so the suite is runnable out of
 * the box against a freshly seeded server_2. Never commit real credentials.
 */
export interface TestUser {
  email: string;
  password: string;
}

export const TEST_USER: TestUser = {
  email: process.env.E2E_USER_EMAIL ?? "testcustomer@flavorstack.local",
  password: process.env.E2E_USER_PASSWORD ?? "Test@1234",
};

/**
 * Seeded platform-ADMIN credentials for the Phase 11 admin-ops E2E suite. There
 * is no self-serve admin signup (server_2 has no admin-register route — role is
 * assigned by an existing admin or a DB seed), so this account must be
 * provisioned out of band. Real values come from `e2e/.env`; the defaults match
 * the documented local admin seed. Never commit real credentials.
 */
export const ADMIN_USER: TestUser = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@flavorstack.local",
  password: process.env.E2E_ADMIN_PASSWORD ?? "Admin@1234",
};
