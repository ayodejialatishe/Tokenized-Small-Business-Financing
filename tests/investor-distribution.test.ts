import { describe, it, expect, beforeEach } from 'vitest';

// Mock implementation for testing Clarity contracts

// Mock state
const state = {
  investments: new Map(),
  distributions: new Map(),
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
};

// Mock functions
const mockFunctions = {
  createInvestment: (sender, investmentId, loanId, amount, sharePercentage) => {
    if (amount <= 0) {
      return { type: 'err', value: 3 }; // ERR_INVALID_INPUT
    }
    
    if (sharePercentage <= 0 || sharePercentage > 10000) {
      return { type: 'err', value: 3 }; // ERR_INVALID_INPUT
    }
    
    if (state.investments.has(investmentId)) {
      return { type: 'err', value: 3 }; // ERR_INVALID_INPUT
    }
    
    state.investments.set(investmentId, {
      loanId,
      investor: sender,
      amount,
      sharePercentage,
      totalDistributed: 0,
      status: 'active'
    });
    
    return { type: 'ok', value: true };
  },
  
  distributeReturns: (sender, distributionId, investmentId, amount) => {
    if (!state.investments.has(investmentId)) {
      return { type: 'err', value: 2 }; // ERR_NOT_FOUND
    }
    
    if (sender !== state.contractOwner) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    const investment = state.investments.get(investmentId);
    
    if (investment.status !== 'active') {
      return { type: 'err', value: 4 }; // ERR_INVESTMENT_NOT_ACTIVE
    }
    
    if (amount <= 0) {
      return { type: 'err', value: 3 }; // ERR_INVALID_INPUT
    }
    
    // Record the distribution
    state.distributions.set(distributionId, {
      investmentId,
      amount,
      blockHeight: 123, // Mock block height
      recipient: investment.investor
    });
    
    // Update the investment
    investment.totalDistributed += amount;
    state.investments.set(investmentId, investment);
    
    return { type: 'ok', value: true };
  },
  
  markInvestmentCompleted: (sender, investmentId) => {
    if (!state.investments.has(investmentId)) {
      return { type: 'err', value: 2 }; // ERR_NOT_FOUND
    }
    
    if (sender !== state.contractOwner) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    const investment = state.investments.get(investmentId);
    
    if (investment.status !== 'active') {
      return { type: 'err', value: 4 }; // ERR_INVESTMENT_NOT_ACTIVE
    }
    
    investment.status = 'completed';
    state.investments.set(investmentId, investment);
    
    return { type: 'ok', value: true };
  },
  
  markInvestmentDefaulted: (sender, investmentId) => {
    if (!state.investments.has(investmentId)) {
      return { type: 'err', value: 2 }; // ERR_NOT_FOUND
    }
    
    if (sender !== state.contractOwner) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    const investment = state.investments.get(investmentId);
    
    if (investment.status !== 'active') {
      return { type: 'err', value: 4 }; // ERR_INVESTMENT_NOT_ACTIVE
    }
    
    investment.status = 'defaulted';
    state.investments.set(investmentId, investment);
    
    return { type: 'ok', value: true };
  },
  
  calculateExpectedReturns: (investmentId) => {
    if (!state.investments.has(investmentId)) {
      return { type: 'err', value: 2 }; // ERR_NOT_FOUND
    }
    
    const investment = state.investments.get(investmentId);
    const principalAmount = investment.amount;
    const sharePercentage = investment.sharePercentage;
    
    // Simple calculation: principal + (principal * share-percentage / 10000)
    const expectedReturns = principalAmount + (principalAmount * sharePercentage / 10000);
    
    return { type: 'ok', value: expectedReturns };
  }
};

describe('Investor Distribution Contract', () => {
  beforeEach(() => {
    // Reset state before each test
    state.investments.clear();
    state.distributions.clear();
  });
  
  it('should create an investment successfully', () => {
    const investor = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const investmentId = 'i123';
    const loanId = 'l123';
    const amount = 50000;
    const sharePercentage = 5000; // 50%
    
    const result = mockFunctions.createInvestment(investor, investmentId, loanId, amount, sharePercentage);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    expect(state.investments.has(investmentId)).toBe(true);
    
    const investment = state.investments.get(investmentId);
    expect(investment.loanId).toBe(loanId);
    expect(investment.investor).toBe(investor);
    expect(investment.amount).toBe(amount);
    expect(investment.sharePercentage).toBe(sharePercentage);
    expect(investment.status).toBe('active');
  });
  
  it('should not create an investment with invalid parameters', () => {
    const investor = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const investmentId = 'i123';
    const loanId = 'l123';
    
    // Invalid amount
    let result = mockFunctions.createInvestment(investor, investmentId, loanId, 0, 5000);
    expect(result.type).toBe('err');
    expect(result.value).toBe(3); // ERR_INVALID_INPUT
    
    // Invalid share percentage (too low)
    result = mockFunctions.createInvestment(investor, investmentId, loanId, 50000, 0);
    expect(result.type).toBe('err');
    expect(result.value).toBe(3); // ERR_INVALID_INPUT
    
    // Invalid share percentage (too high)
    result = mockFunctions.createInvestment(investor, investmentId, loanId, 50000, 10001);
    expect(result.type).toBe('err');
    expect(result.value).toBe(3); // ERR_INVALID_INPUT
  });
  
  it('should distribute returns successfully', () => {
    const investor = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const investmentId = 'i123';
    const loanId = 'l123';
    const distributionId = 'd123';
    
    // Create investment
    mockFunctions.createInvestment(investor, investmentId, loanId, 50000, 5000);
    
    // Distribute returns
    const result = mockFunctions.distributeReturns(state.contractOwner, distributionId, investmentId, 10000);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    
    // Check investment was updated
    const investment = state.investments.get(investmentId);
    expect(investment.totalDistributed).toBe(10000);
    
    // Check distribution was recorded
    expect(state.distributions.has(distributionId)).toBe(true);
    
    const distribution = state.distributions.get(distributionId);
    expect(distribution.investmentId).toBe(investmentId);
    expect(distribution.amount).toBe(10000);
    expect(distribution.recipient).toBe(investor);
  });
  
  it('should not allow unauthorized distribution', () => {
    const investor = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const unauthorizedSender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const investmentId = 'i123';
    const loanId = 'l123';
    const distributionId = 'd123';
    
    // Create investment
    mockFunctions.createInvestment(investor, investmentId, loanId, 50000, 5000);
    
    // Try to distribute returns without authorization
    const result = mockFunctions.distributeReturns(unauthorizedSender, distributionId, investmentId, 10000);
    
    expect(result.type).toBe('err');
    expect(result.value).toBe(1); // ERR_UNAUTHORIZED
  });
  
  it('should mark investment as completed', () => {
    const investor = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const investmentId = 'i123';
    const loanId = 'l123';
    
    // Create investment
    mockFunctions.createInvestment(investor, investmentId, loanId, 50000, 5000);
    
    // Mark as completed
    const result = mockFunctions.markInvestmentCompleted(state.contractOwner, investmentId);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    
    // Check investment status
    const investment = state.investments.get(investmentId);
    expect(investment.status).toBe('completed');
  });
  
  it('should mark investment as defaulted', () => {
    const investor = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const investmentId = 'i123';
    const loanId = 'l123';
    
    // Create investment
    mockFunctions.createInvestment(investor, investmentId, loanId, 50000, 5000);
    
    // Mark as defaulted
    const result = mockFunctions.markInvestmentDefaulted(state.contractOwner, investmentId);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    
    // Check investment status
    const investment = state.investments.get(investmentId);
    expect(investment.status).toBe('defaulted');
  });
  
  it('should calculate expected returns correctly', () => {
    const investor = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const investmentId = 'i123';
    const loanId = 'l123';
    const amount = 50000;
    const sharePercentage = 2000; // 20%
    
    // Create investment
    mockFunctions.createInvestment(investor, investmentId, loanId, amount, sharePercentage);
    
    // Calculate expected returns
    const result = mockFunctions.calculateExpectedReturns(investmentId);
    
    expect(result.type).toBe('ok');
    // Principal + (Principal * Share%) = 50000 + (50000 * 20%) = 50000 + 10000 = 60000
    expect(result.value).toBe(60000);
  });
});
