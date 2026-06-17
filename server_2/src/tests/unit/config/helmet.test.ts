import { getHelmetOptions } from '../../../config/helmet';

describe('getHelmetOptions', () => {
  it('restricts default content sources to self', () => {
    const options = getHelmetOptions();

    const directives = (options.contentSecurityPolicy as { directives: Record<string, unknown> }).directives;
    expect(directives.defaultSrc).toEqual(["'self'"]);
  });

  it('sets a cross-origin resource policy', () => {
    const options = getHelmetOptions();

    expect(options.crossOriginResourcePolicy).toEqual({ policy: 'cross-origin' });
  });
});
