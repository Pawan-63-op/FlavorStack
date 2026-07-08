import { describe, expect, it } from "vitest";
import { emptyProfileForm, toProfileForm } from "./ProfileCard.helpers";
import { userAdapter, type UserResponse } from "@/lib/api/adapters/user";

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

describe("toProfileForm", () => {
  it("returns the empty form when user is null", () => {
    expect(toProfileForm(null)).toEqual(emptyProfileForm);
  });

  it("maps server-backed fields from the adapted user", () => {
    const user = userAdapter(makeUserResponse());

    const form = toProfileForm(user);

    expect(form.name).toBe("Jane Doe");
    expect(form.email).toBe("jane@example.com");
    expect(form.avatar).toBe("https://example.com/avatar.png");
  });

  it("falls back to empty strings for missing local profileExtras", () => {
    const user = userAdapter(makeUserResponse());

    const form = toProfileForm(user);

    expect(form.phone).toBe("");
    expect(form.bio).toBe("");
    expect(form.birthday).toBe("");
    expect(form.occupation).toBe("");
    expect(form.location).toBe("");
  });

  it("includes merged local profileExtras when present on the user", () => {
    const user = userAdapter(makeUserResponse());
    const merged = { ...user, phone: "555-1234", bio: "Hello there" };

    const form = toProfileForm(merged);

    expect(form.phone).toBe("555-1234");
    expect(form.bio).toBe("Hello there");
  });

  it("defaults avatar to an empty string when avatarUrl is missing", () => {
    const dto = makeUserResponse();
    delete dto.avatarUrl;
    const user = userAdapter(dto);

    const form = toProfileForm(user);

    expect(form.avatar).toBe("");
  });
});
