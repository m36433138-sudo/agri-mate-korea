import { describe, it, expect } from 'vitest';
import { validateMachineTypeClassification } from './machineValidation';
describe('customer machine registration', () => {
  it('requires a machine classification so sold tractors remain in their category', () => {
    expect(validateMachineTypeClassification({ machine_type: '중고기계', classification: '' }).ok).toBe(false);
    expect(validateMachineTypeClassification({ machine_type: '중고기계', classification: '농업용트랙터' }).ok).toBe(true);
  });
});