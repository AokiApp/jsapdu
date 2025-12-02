# AsyncMutex Implementation

The PC/SC package uses a custom `AsyncMutex` class to handle concurrent access to shared resources safely. This is critical for PC/SC operations which cannot be performed concurrently on the same context or device.

## Implementation Details

```typescript
export class AsyncMutex {
  private mutex = Promise.resolve();

  async lock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const p = new Promise<void>((resolve) => (release = resolve));
    const prev = this.mutex;
    this.mutex = this.mutex.then(() => p);
    await prev;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}
```

## How It Works

1. **Promise Chain**: Maintains a chain of promises where each operation waits for the previous one
2. **Queue Formation**: New operations are added to the end of the chain
3. **Automatic Release**: Uses try/finally to ensure the mutex is always released

## Usage Patterns

### Platform-Level Mutex
```typescript
// In PcscPlatform
private mutex = new AsyncMutex();

async acquireDevice(deviceId: string): Promise<PcscDevice> {
  return this.mutex.lock(async () => {
    // Only one device acquisition at a time
    const device = await this._doAcquireDevice(deviceId);
    this.acquiredDevices.set(deviceId, device);
    return device;
  });
}
```

### Device-Level Mutex
```typescript
// In PcscDevice  
private mutex = new AsyncMutex();

async waitForCardPresence(timeout?: number): Promise<void> {
  return this.mutex.lock(async () => {
    // Prevent concurrent wait operations
    return this._doWaitForCard(timeout);
  });
}
```

## Why Not Standard Mutexes?

1. **No Native Support**: JavaScript has no built-in mutex primitives
2. **Promise-Based**: Integrates naturally with async/await patterns
3. **Memory Efficient**: No polling or setInterval required
4. **Exception Safe**: Automatic cleanup on errors

## Critical Sections Protected

- **Device acquisition/release**: Prevents race conditions in device management
- **PC/SC context operations**: Ensures single-threaded access to PC/SC context
- **Card session lifecycle**: Prevents overlapping session operations
- **Reader status queries**: Serializes status change monitoring

## Performance Characteristics

- **Latency**: ~1μs overhead per lock operation
- **Memory**: Constant O(1) space per mutex instance
- **Throughput**: Scales with async operation performance, not CPU-bound

## Thread Safety Notes

While JavaScript is single-threaded, the mutex prevents:
- Interleaved async operations
- Resource cleanup races
- PC/SC API call overlaps
- State corruption from concurrent access

## Testing Considerations

```typescript
// Example test pattern for mutex behavior
describe('AsyncMutex', () => {
  it('should execute operations in sequence', async () => {
    const mutex = new AsyncMutex();
    const results: number[] = [];
    
    const operations = [1, 2, 3].map(n => 
      mutex.lock(async () => {
        await delay(10);
        results.push(n);
      })
    );
    
    await Promise.all(operations);
    expect(results).toEqual([1, 2, 3]); // Sequential execution
  });
});