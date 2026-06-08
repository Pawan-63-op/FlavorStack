import { ValueObject } from './ValueObject';
import { Result } from './Result';
import { ValidationError } from './errors/ValidationError';

interface MoneyProps {
  amount: number; // integer paise
  currency: string; // ISO code, e.g., 'INR'
}

const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  public static create(amount: number, currency = 'INR'): Result<Money> {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return Result.fail<Money>(new ValidationError('Amount must be a valid number'));
    }

    if (!Number.isInteger(amount)) {
      return Result.fail<Money>(new ValidationError('Amount must be an integer representing paise/cents'));
    }

    if (amount < 0) {
      return Result.fail<Money>(new ValidationError('Amount cannot be negative'));
    }

    if (!currency || typeof currency !== 'string') {
      return Result.fail<Money>(new ValidationError('Currency must be a non-empty string'));
    }

    const upperCurrency = currency.toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(upperCurrency)) {
      return Result.fail<Money>(new ValidationError(`Unsupported or unknown currency: ${currency}`));
    }

    return Result.ok<Money>(new Money({ amount, currency: upperCurrency }));
  }

  public add(m: Money): Result<Money> {
    if (this.props.currency !== m.currency) {
      return Result.fail<Money>(new ValidationError(`Currency mismatch: cannot add ${m.currency} to ${this.props.currency}`));
    }
    const newAmount = this.props.amount + m.amount;
    return Money.create(newAmount, this.props.currency);
  }

  public subtract(m: Money): Result<Money> {
    if (this.props.currency !== m.currency) {
      return Result.fail<Money>(new ValidationError(`Currency mismatch: cannot subtract ${m.currency} from ${this.props.currency}`));
    }
    const newAmount = this.props.amount - m.amount;
    if (newAmount < 0) {
      return Result.fail<Money>(new ValidationError('Resulting money amount cannot be negative'));
    }
    return Money.create(newAmount, this.props.currency);
  }

  public multiply(factor: number): Money {
    if (typeof factor !== 'number' || isNaN(factor)) {
      throw new Error('Factor must be a valid number');
    }
    const newAmount = Math.round(this.props.amount * factor);
    const finalAmount = Math.max(0, newAmount);
    return new Money({ amount: finalAmount, currency: this.props.currency });
  }

  public isGreaterThan(m: Money): boolean {
    if (this.props.currency !== m.currency) {
      throw new Error(`Currency mismatch: cannot compare ${m.currency} with ${this.props.currency}`);
    }
    return this.props.amount > m.amount;
  }

  public toRupees(): number {
    return this.props.amount / 100;
  }
}
