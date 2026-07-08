import { Cart, CartProps } from '../../../domain/commerce/entities/Cart';
import { CartItem, CartItemProps } from '../../../domain/commerce/entities/CartItem';
import { Quantity } from '../../../domain/commerce/value-objects/Quantity';
import { AppliedPromotion } from '../../../domain/commerce/value-objects/AppliedPromotion';
import { PromotionKind } from '../../../domain/commerce/enums/promotion-kind.enum';
import { Money } from '../../../domain/shared/Money';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import { CartDocument, CartItemDocument, MoneyDocument, AppliedPromotionDocument } from '../models/CartModel';
import { rebuildOrThrow } from './rebuildOrThrow';

function moneyToPersistence(money: Money): MoneyDocument {
  return { amount: money.amount, currency: money.currency };
}

function moneyToDomain(doc: MoneyDocument, context: string): Money {
  return rebuildOrThrow(Money.create(doc.amount, doc.currency), context);
}

function cartItemToPersistence(item: CartItem): CartItemDocument {
  return {
    id: item.id.toString(),
    menuItemId: item.menuItemId,
    quantity: item.quantity.value,
    selectedOptionIds: item.selectedOptionIds,
    unitPriceSnapshot: moneyToPersistence(item.unitPriceSnapshot),
  };
}

function cartItemToDomain(doc: CartItemDocument): CartItem {
  const quantity = rebuildOrThrow(Quantity.create(doc.quantity), `CartItem quantity (${doc.id})`);
  const unitPriceSnapshot = moneyToDomain(
    doc.unitPriceSnapshot,
    `CartItem unitPriceSnapshot (${doc.id})`
  );

  const props: CartItemProps = {
    menuItemId: doc.menuItemId,
    quantity,
    selectedOptionIds: [...doc.selectedOptionIds],
    unitPriceSnapshot,
  };

  return rebuildOrThrow(CartItem.create(props, new UniqueEntityId(doc.id)), `CartItem (${doc.id})`);
}

function appliedPromotionToPersistence(promotion: AppliedPromotion): AppliedPromotionDocument {
  return {
    code: promotion.code,
    kind: promotion.kind,
    discount: moneyToPersistence(promotion.discount),
    sourceRef: promotion.sourceRef,
  };
}

function appliedPromotionToDomain(doc: AppliedPromotionDocument): AppliedPromotion {
  const discount = moneyToDomain(doc.discount, `AppliedPromotion discount (${doc.code})`);
  return rebuildOrThrow(
    AppliedPromotion.create({
      code: doc.code,
      kind: doc.kind as PromotionKind,
      discount,
      sourceRef: doc.sourceRef,
    }),
    `AppliedPromotion (${doc.code})`
  );
}

export class CartMapper {
  static toPersistence(cart: Cart): CartDocument {
    return {
      _id: cart.id.toString(),
      customerId: cart.customerId,
      restaurantId: cart.restaurantId,
      items: cart.items.map(cartItemToPersistence),
      currency: cart.currency,
      appliedPromotion: cart.appliedPromotion ? appliedPromotionToPersistence(cart.appliedPromotion) : null,
      version: cart.version,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  static toDomain(doc: CartDocument): Cart {
    const props: CartProps = {
      customerId: doc.customerId,
      restaurantId: doc.restaurantId,
      items: doc.items.map(cartItemToDomain),
      currency: doc.currency,
      appliedPromotion: doc.appliedPromotion ? appliedPromotionToDomain(doc.appliedPromotion) : null,
      version: doc.version,
      createdAt: doc.createdAt ?? new Date(),
      updatedAt: doc.updatedAt ?? new Date(),
    };

    return Cart.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
