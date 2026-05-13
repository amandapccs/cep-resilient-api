import { ProviderRotatorService } from '../src/modules/cep/strategy/provider-rotator.service';

describe('ProviderRotatorService', () => {
  it('starts with the declared order', () => {
    const service = new ProviderRotatorService();

    expect(service.orderProviders(['via-cep', 'brasil-api'])).toEqual([
      'via-cep',
      'brasil-api',
    ]);
  });

  it('rotates providers on the next call', () => {
    const service = new ProviderRotatorService();

    service.orderProviders(['via-cep', 'brasil-api']);

    expect(service.orderProviders(['via-cep', 'brasil-api'])).toEqual([
      'brasil-api',
      'via-cep',
    ]);
  });

  it('keeps a single provider unchanged', () => {
    const service = new ProviderRotatorService();

    expect(service.orderProviders(['via-cep'])).toEqual(['via-cep']);
  });
});
