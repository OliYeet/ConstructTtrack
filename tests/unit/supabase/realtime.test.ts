/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe('realtime helper – subscribeToTable & helpers', () => {
  let mockClient: any;
  const mockChannels = new Map<string, any>();

  beforeEach(() => {
    jest.resetModules();

    mockChannels.clear();

    mockClient = {
      channel: jest.fn((name: string) => {
        if (mockChannels.has(name)) return mockChannels.get(name);

        const ch = {
          name,
          on: jest.fn().mockReturnThis(),
          subscribe: jest.fn(),
        };
        mockChannels.set(name, ch);
        return ch;
      }),
      removeChannel: jest.fn((ch: any) => {
        mockChannels.delete(ch.name);
      }),
    };

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => mockClient),
    }));

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  const importModule = () =>
    import('../../../packages/supabase/client/realtime');

  it('creates only one channel per table', async () => {
    const { subscribeToTable } = await importModule();
    const handler = jest.fn();

    const channel1 = subscribeToTable('projects', handler);
    const channel2 = subscribeToTable('projects', handler);

    expect(channel1).toBe(channel2);
    expect(mockClient.channel).toHaveBeenCalledTimes(1);
  });

  it('registers a handler only once for the same channel', async () => {
    const { subscribeToTable } = await importModule();
    const handler = jest.fn();

    subscribeToTable('tasks', handler);
    subscribeToTable('tasks', handler); // duplicate – should be ignored

    const channel = mockChannels.get('public:tasks');
    expect(channel).toBeDefined();
    expect(channel.on).toHaveBeenCalledTimes(1);
  });

  it('different handlers for the same table are all registered', async () => {
    const { subscribeToTable } = await importModule();
    const handlerA = jest.fn();
    const handlerB = jest.fn();

    subscribeToTable('photos', handlerA);
    subscribeToTable('photos', handlerB);

    const channel = mockChannels.get('public:photos');
    expect(channel.on).toHaveBeenCalledTimes(2);
  });

  it('initRealtimeSubscriptions creates channels for all managed tables', async () => {
    const { initRealtimeSubscriptions, managedTableNames } =
      await importModule();

    const dispatch = jest.fn();
    initRealtimeSubscriptions(dispatch as any);

    expect(mockClient.channel).toHaveBeenCalledTimes(managedTableNames.length);
    managedTableNames.forEach((name) => {
      expect(mockChannels.get(`public:${name as string}`)).toBeDefined();
    });
  });

  it('removeRealtimeSubscriptions cleans-up channels', async () => {
    const { initRealtimeSubscriptions, removeRealtimeSubscriptions } =
      await importModule();

    initRealtimeSubscriptions(jest.fn() as any);
    // Capture the number of channels that exist **before** removal.
    const channelCountBeforeRemoval = mockChannels.size;
    removeRealtimeSubscriptions();

    expect(mockClient.removeChannel).toHaveBeenCalledTimes(
      channelCountBeforeRemoval,
    );
    expect(mockChannels.size).toBe(0);
  });
});
