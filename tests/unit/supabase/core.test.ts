describe('supabase client core utilities', () => {
  const SUPABASE_URL = 'https://example.supabase.co';
  const SUPABASE_ANON_KEY = 'anon-key';

  // Hold reference so every `createClient()` returns the *same* object when
  // required by the tests.
  let mockClient: any;

  beforeEach(() => {
    jest.resetModules();

    // Ensure a clean env for every test
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    jest.mock('@supabase/supabase-js', () => {
      const createClient = jest.fn(() => mockClient);
      return { createClient };
    });

    mockClient = { channel: jest.fn(), removeChannel: jest.fn() };
  });

  it('lazily creates the Supabase client only once', async () => {
    const { getSupabaseClient } = await import(
      '../../../packages/supabase/client/core'
    );
    const client1 = getSupabaseClient();
    const client2 = getSupabaseClient();

    // same instance should be returned
    expect(client1).toBe(client2);

    // createClient from @supabase/supabase-js should be invoked **once**
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js');
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      expect.any(Object)
    );
  });

  it('throws a helpful error when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    await jest.isolateModulesAsync(async () => {
      const { getSupabaseClient } = await import(
        '../../../packages/supabase/client/core'
      );
      expect(() => getSupabaseClient()).toThrow(
        /Missing Supabase environment variables/i
      );
    });
  });
});
