# E2E Testing and Mocking Strategy

## Current E2E Test Setup

E2E tests in `examples/mynacard-e2e/` test actual SmartCard hardware interaction using the PC/SC platform implementation.

### Test Execution Modes

1. **Local Development** (hardware available):
   ```bash
   npm test              # All tests including E2E
   npm run test:e2e      # Only E2E tests
   ```

2. **CI Environment** (no hardware):
   ```bash
   npm run test:ci       # Unit tests only (E2E skipped)
   ```

3. **CI with E2E** (optional, requires hardware):
   ```bash
   RUN_E2E_TESTS=true npm test  # Requires libpcsclite-dev
   ```

## Environment Detection

The test configuration automatically detects CI environments and skips E2E tests unless explicitly enabled:

- `CI=true` → E2E tests skipped (default CI behavior)
- `CI=true RUN_E2E_TESTS=true` → E2E tests run (requires hardware setup)
- Local (no `CI` env) → All tests run

## Future Enhancement: Mock-based E2E Testing

### Objective

Enable comprehensive E2E testing without physical hardware by injecting pre-recorded APDU responses.

### Proposed Approach

1. **Interface-based Mocking**: Create mock implementations of `SmartCardPlatform`, `SmartCardDevice`, and `SmartCard` interfaces

2. **APDU Response Injection**: 
   ```typescript
   interface MockAPDUResponse {
     command: CommandApdu;
     response: ResponseApdu;
   }
   
   class MockSmartCard implements SmartCard {
     constructor(private responses: MockAPDUResponse[]) {}
     
     async transmit(command: CommandApdu): Promise<ResponseApdu> {
       const mock = this.responses.find(r => 
         r.command.matches(command)
       );
       return mock?.response ?? errorResponse;
     }
   }
   ```

3. **Test Scenarios**:
   - Record real card interactions as fixtures
   - Replay them in CI using mock platform
   - Test error handling and edge cases

4. **Configuration**:
   ```bash
   USE_MOCK_PLATFORM=true npm test  # Use mocked card responses
   ```

### Implementation Notes

- Keep real E2E tests for validation with actual hardware
- Mock tests provide fast feedback in CI
- Use type safety to ensure mock implementations match interfaces
- Consider using `vitest.mock()` for platform manager injection

### Example Test with Mock

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MockPlatformManager } from "./mocks/platform";
import { recordedMynaCardResponses } from "./fixtures/mynacard-responses";

describe("MynaCard E2E (Mocked)", () => {
  let platform: SmartCardPlatform;

  beforeEach(() => {
    if (process.env.USE_MOCK_PLATFORM) {
      platform = new MockPlatformManager(recordedMynaCardResponses).getPlatform();
    } else {
      platform = PcscPlatformManager.getInstance().getPlatform();
    }
  });

  it("reads JPKI certificate", async () => {
    await platform.init();
    const devices = await platform.getDeviceInfo();
    // ... rest of test works with both real and mock platforms
  });
});
```

## Benefits of Mock-based Testing

1. **CI Compatibility**: Tests run in any CI environment without hardware
2. **Deterministic**: Same responses every time, no flaky tests
3. **Fast**: No actual card communication overhead
4. **Comprehensive**: Test error cases that are hard to reproduce with real cards
5. **Safe**: Keep real E2E tests for validation, use mocks for quick feedback

## Current Status

✅ E2E tests skip gracefully in CI  
✅ Can run E2E tests locally with hardware  
✅ Can optionally enable E2E in CI with proper setup  
🔄 Mock-based testing is a future enhancement
