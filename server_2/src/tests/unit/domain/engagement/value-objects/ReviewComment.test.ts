import { ReviewComment } from '../../../../../domain/engagement/value-objects/ReviewComment';

describe('ReviewComment', () => {
  it('trims and stores text within the cap', () => {
    const result = ReviewComment.create('  Great food!  ');
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().value).toBe('Great food!');
  });

  it('rejects empty/whitespace-only text', () => {
    expect(ReviewComment.create('   ').isFailure).toBe(true);
  });

  it('rejects text over 1000 chars', () => {
    const result = ReviewComment.create('a'.repeat(1001));
    expect(result.isFailure).toBe(true);
  });

  it('accepts exactly 1000 chars', () => {
    const result = ReviewComment.create('a'.repeat(1000));
    expect(result.isSuccess).toBe(true);
  });

  it('reports length', () => {
    const comment = ReviewComment.create('hello').getValue();
    expect(comment.length).toBe(5);
  });
});
