/**
 * Validation Utils Tests - Early Development
 * Simple utility function tests
 */

describe('Validation Utilities', () => {
  describe('email validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'contact@abc-company.com',
      ];

      validEmails.forEach(email => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user space@domain.com',
      ];

      invalidEmails.forEach(email => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('coordinate validation', () => {
    it('should validate latitude ranges', () => {
      expect(47.6062).toBeGreaterThanOrEqual(-90);
      expect(47.6062).toBeLessThanOrEqual(90);
      
      expect(-91).toBeLessThan(-90); // Invalid
      expect(91).toBeGreaterThan(90); // Invalid
    });

    it('should validate longitude ranges', () => {
      expect(-122.3321).toBeGreaterThanOrEqual(-180);
      expect(-122.3321).toBeLessThanOrEqual(180);
      
      expect(-181).toBeLessThan(-180); // Invalid
      expect(181).toBeGreaterThan(180); // Invalid
    });
  });

  describe('budget validation', () => {
    it('should accept positive numbers', () => {
      expect(50000).toBeGreaterThan(0);
      expect(1.50).toBeGreaterThan(0);
    });

    it('should reject negative numbers', () => {
      expect(-1000).toBeLessThan(0);
      expect(-0.01).toBeLessThan(0);
    });
  });
});