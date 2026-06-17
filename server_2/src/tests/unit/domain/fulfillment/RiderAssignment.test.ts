import { RiderAssignment } from '../../../../domain/fulfillment/entities/RiderAssignment';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';

function futureDate(msFromNow = 60_000): Date {
  return new Date(Date.now() + msFromNow);
}

describe('RiderAssignment.offer', () => {
  it('creates an OFFERED assignment with the given rider, attempt and TTL', () => {
    const expiresAt = futureDate();
    const result = RiderAssignment.offer({ riderId: 'rider-1', attempt: 1, expiresAt });

    expect(result.isSuccess).toBe(true);
    const a = result.getValue();
    expect(a.riderId).toBe('rider-1');
    expect(a.attempt).toBe(1);
    expect(a.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
    expect(a.acceptedAt).toBeNull();
    expect(a.respondedAt).toBeNull();
    expect(a.expiresAt).toBe(expiresAt);
    expect(a.isActive()).toBe(true);
  });

  it('rejects an empty riderId', () => {
    expect(RiderAssignment.offer({ riderId: '', attempt: 1, expiresAt: futureDate() }).isFailure).toBe(true);
  });

  it('rejects a non-positive attempt', () => {
    expect(RiderAssignment.offer({ riderId: 'r', attempt: 0, expiresAt: futureDate() }).isFailure).toBe(true);
  });

  it('rejects an expiresAt that is not after offeredAt', () => {
    const offeredAt = new Date();
    const result = RiderAssignment.offer({ riderId: 'r', attempt: 1, offeredAt, expiresAt: offeredAt });
    expect(result.isFailure).toBe(true);
  });
});

describe('RiderAssignment.accept', () => {
  it('transitions OFFERED → ACCEPTED and stamps acceptedAt / respondedAt', () => {
    const a = RiderAssignment.offer({ riderId: 'r', attempt: 1, expiresAt: futureDate() }).getValue();
    const now = new Date();

    const result = a.accept(now);

    expect(result.isSuccess).toBe(true);
    expect(a.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(a.acceptedAt).toBe(now);
    expect(a.respondedAt).toBe(now);
  });

  it('fails to accept after expiresAt (TTL respected)', () => {
    const offeredAt = new Date(Date.now() - 120_000);
    const expiresAt = new Date(Date.now() - 60_000); // already past
    const a = RiderAssignment.offer({ riderId: 'r', attempt: 1, offeredAt, expiresAt }).getValue();

    const result = a.accept(new Date());

    expect(result.isFailure).toBe(true);
    expect(a.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
    expect(a.acceptedAt).toBeNull();
  });

  it('cannot accept twice', () => {
    const a = RiderAssignment.offer({ riderId: 'r', attempt: 1, expiresAt: futureDate() }).getValue();
    a.accept();
    expect(a.accept().isFailure).toBe(true);
  });
});

describe('RiderAssignment.reject', () => {
  it('transitions OFFERED → REJECTED and stamps respondedAt', () => {
    const a = RiderAssignment.offer({ riderId: 'r', attempt: 1, expiresAt: futureDate() }).getValue();
    const now = new Date();

    const result = a.reject(now);

    expect(result.isSuccess).toBe(true);
    expect(a.status.value).toBe(RIDER_ASSIGNMENT_STATUS.REJECTED);
    expect(a.respondedAt).toBe(now);
    expect(a.acceptedAt).toBeNull();
    expect(a.isActive()).toBe(false);
  });

  it('cannot reject an already-accepted assignment', () => {
    const a = RiderAssignment.offer({ riderId: 'r', attempt: 1, expiresAt: futureDate() }).getValue();
    a.accept();
    expect(a.reject().isFailure).toBe(true);
  });
});
