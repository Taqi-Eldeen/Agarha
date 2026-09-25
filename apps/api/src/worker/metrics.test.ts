import { emf } from './metrics';

describe('EMF metrics', () => {
  it('declares every value as a metric in the Agarha namespace with units', () => {
    const line = emf('production', { QueueOldestWaitSeconds: 42, OtpFailurePercent: 12.5, OtpSendAttempts: 8 }, 1_700_000_000_000);
    expect(line.Environment).toBe('production');
    expect(line.QueueOldestWaitSeconds).toBe(42);
    expect(line._aws.CloudWatchMetrics[0]).toEqual({
      Namespace: 'Agarha',
      Dimensions: [['Environment']],
      Metrics: [
        { Name: 'QueueOldestWaitSeconds', Unit: 'Seconds' },
        { Name: 'OtpFailurePercent', Unit: 'Percent' },
        { Name: 'OtpSendAttempts', Unit: 'Count' },
      ],
    });
  });
});
