/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
describe('realtime integration – complete lifecycle', () => {
  let mockClient: any;
  const channelEvents: any[] = [];

  beforeEach(() => {
    jest.resetModules();

    mockClient = {
      channel: jest.fn((name: string) => ({
        name,
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback?: (status: string) => void) => {
          // simulate the asynchronous subscription acknowledgement
          if (callback) callback('SUBSCRIBED');
        }),
      })),
      removeChannel: jest.fn(),
    };

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => mockClient),
    }));

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  it('end-to-end: init -> subscribeToTable -> removeRealtimeSubscriptions', async () => {
    const {
      initRealtimeSubscriptions,
      subscribeToTable,
      removeRealtimeSubscriptions,
      managedTableNames,
    } = await import('../../../packages/supabase/client/realtime');

    const dispatch = jest.fn((payload, table) =>
      channelEvents.push({ payload, table }),
    );

    // Start global listeners
    initRealtimeSubscriptions(dispatch as any);
    expect(mockClient.channel).toHaveBeenCalledTimes(managedTableNames.length);

    // Ad-hoc subscription to a single table
    subscribeToTable('fiber_routes', dispatch as any);
    // Should NOT create a new channel because one exists from init
    expect(mockClient.channel).toHaveBeenCalledTimes(managedTableNames.length);

    // Now clean-up
    removeRealtimeSubscriptions();
    expect(mockClient.removeChannel).toHaveBeenCalledTimes(
      managedTableNames.length,
    );
  });
});
