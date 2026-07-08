import { describe, expect, it } from "vitest";
import { mergeProfile, userAdapter, type UserResponse } from "./user";

function makeUserResponse(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: "u1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "CUSTOMER",
    isEmailVerified: true,
    avatarUrl: "https://example.com/avatar.png",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("userAdapter", () => {
  it("maps a CUSTOMER UserResponse to the FE User shape", () => {
    const dto = makeUserResponse();

    const user = userAdapter(dto);

    expect(user).toEqual({
      _id: "u1",
      id: "u1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "CUSTOMER",
      isVerified: true,
      avatar: "https://example.com/avatar.png",
      isAdmin: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("derives isAdmin true only for role==='ADMIN'", () => {
    const admin = userAdapter(makeUserResponse({ role: "ADMIN" }));
    const customer = userAdapter(makeUserResponse({ role: "CUSTOMER" }));
    const driver = userAdapter(makeUserResponse({ role: "DRIVER" }));

    expect(admin.isAdmin).toBe(true);
    expect(customer.isAdmin).toBe(false);
    expect(driver.isAdmin).toBe(false);
  });

  it("sets _id equal to id", () => {
    const user = userAdapter(makeUserResponse({ id: "abc123" }));

    expect(user._id).toBe("abc123");
    expect(user._id).toBe(user.id);
  });

  it("maps a missing avatarUrl to an undefined avatar", () => {
    const dto = makeUserResponse();
    delete dto.avatarUrl;

    const user = userAdapter(dto);

    expect(user.avatar).toBeUndefined();
  });

  it("maps isEmailVerified=false to isVerified=false", () => {
    const user = userAdapter(makeUserResponse({ isEmailVerified: false }));

    expect(user.isVerified).toBe(false);
  });
});

describe("mergeProfile", () => {
  it("merges local profileExtras onto the server-backed user for display", () => {
    const user = userAdapter(makeUserResponse());

    const merged = mergeProfile(user, { phone: "555-1234", bio: "Hello" });

    expect(merged).toEqual({
      ...user,
      phone: "555-1234",
      bio: "Hello",
    });
  });
});
