import {
  ICustomerTrackingRepository,
  CustomerTrackingView,
  CustomerOrderSummaryView,
  CustomerOrderQuery,
  TrackingTimelineEntry,
} from '../../domain/fulfillment/repositories/ICustomerTrackingRepository';
import {
  CustomerTrackingViewModel,
  CustomerTrackingViewDocument,
} from '../database/models/CustomerTrackingViewModel';

function docToCustomerTracking(doc: CustomerTrackingViewDocument): CustomerTrackingView {
  return {
    fulfillmentId: doc._id,
    orderRequestId: doc.orderRequestId,
    customerId: doc.customerId,
    restaurantId: doc.restaurantId,
    currentStatus: doc.currentStatus,
    deliveryStatus: doc.deliveryStatus,
    riderId: doc.riderId,
    timeline: doc.timeline.map((t) => ({ eventId: t.eventId, status: t.status, at: t.at, note: t.note })),
    deliveryAddress: doc.deliveryAddress as CustomerTrackingView['deliveryAddress'],
    total: doc.total,
    cancellation: doc.cancellation ?? null,
    failureReason: doc.failureReason,
    updatedAt: doc.updatedAt,
  };
}

function docToCustomerOrderSummary(doc: CustomerTrackingViewDocument): CustomerOrderSummaryView {
  const placedAt = doc.timeline.reduce<Date>(
    (earliest, t) => (t.at < earliest ? t.at : earliest),
    doc.timeline[0]?.at ?? doc.updatedAt
  );
  return {
    fulfillmentId: doc._id,
    orderRequestId: doc.orderRequestId,
    restaurantId: doc.restaurantId,
    fulfillmentStatus: doc.currentStatus,
    deliveryStatus: doc.deliveryStatus,
    total: doc.total,
    placedAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoCustomerTrackingRepository implements ICustomerTrackingRepository {

  async upsertCustomerTracking(params: {
    fulfillmentId: string;
    eventId: string;
    set: Partial<Omit<CustomerTrackingView, 'fulfillmentId' | 'timeline'>>;
    timelineEntry: TrackingTimelineEntry;
  }): Promise<void> {
    const { fulfillmentId, eventId, set, timelineEntry } = params;

    await CustomerTrackingViewModel.updateOne(
      { _id: fulfillmentId },
      { $set: { ...set, updatedAt: new Date() } },
      { upsert: true }
    );

    // The real idempotency guard: a replayed event finds its eventId already in `timeline`
    // and appends nothing. (Phase 3 dropped the parallel `processedEventIds` set, which was
    // written on every event and never read.)
    await CustomerTrackingViewModel.updateOne(
      { _id: fulfillmentId, 'timeline.eventId': { $ne: eventId } },
      { $push: { timeline: timelineEntry } }
    );
  }

  async findCustomerTracking(fulfillmentId: string): Promise<CustomerTrackingView | null> {
    const doc = await CustomerTrackingViewModel.findById(fulfillmentId).lean<CustomerTrackingViewDocument>();
    return doc ? docToCustomerTracking(doc) : null;
  }

  async findByCustomer(customerId: string, query?: CustomerOrderQuery): Promise<CustomerOrderSummaryView[]> {
    const docs = await CustomerTrackingViewModel.find({ customerId })
      .sort({ updatedAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? 50)
      .lean<CustomerTrackingViewDocument[]>();
    return docs.map(docToCustomerOrderSummary);
  }
}
