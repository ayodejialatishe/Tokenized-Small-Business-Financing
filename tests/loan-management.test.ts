import { describe, it, expect, beforeEach } from 'vitest';

// Mock implementation for testing Clarity contracts

// Mock state
const state = {
  loans: new Map(),
  repayments: new Map(),
  repaymentCounter: 0,
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
};

// Mock functions
const mockFunctions = {
  createLoan: (sender, loanId, businessId, amount, interestRate, termLength) => {
    if (amount <= 0 || interestRate < 0 || termLength <= 0) {
      return { type: 'err', value: 3 }; // ERR_INVALID_INPUT
    }
    
    if (state.loans.has(loanId)) {
      return { type: 'err', value: 3 }; // ERR_INVALID_INPUT
    }
    
    const blockHeight = 123; // Mock block height
    
    state.loans.set(loanId, {
      businessId,
      amount,
      interestRate,
      termLength,
      startBlock: blockHeight,
      endBlock: blockHeight + termLength,
      totalRepaid: 0,
      status: 'active',
      borrower: sender
    });
    
    return { type: 'ok', value: true };
  },
  
  makeRepayment: (sender, loanId, amount) => {
    if (!state.loans.has(loanId)) {
      return { type: 'err', value: 2 }; // ERR_NOT_FOUND
    }
    
    const loan = state.loans.get(loanId);
    
    if (loan.status !== 'active') {
      return { type: 'err', value: 4 }; // ERR_LOAN_NOT_ACTIVE
    }
    
    if (amount <= 0) {
      return { type: 'err', value: 3 }; // ERR_INVALID_INPUT
    }
    
    const repaymentId = state.repaymentCounter;
    const repaymentKey = `${loanId}-${repaymentId}`;
    
    // Record the repayment
    state.repayments.set(repaymentKey, {
      amount,
      blockHeight: 123, // Mock block height
      payer: sender
    });
    
    // Update the loan
    const newTotalRepaid = loan.totalRepaid + amount;
    loan.totalRepaid = newTotalRepaid;
    
    if (newTotalRepaid >= loan.amount) {
      loan.status = 'repaid';
    }
    
    state.loans.set(loanId, loan);
    
    // Increment the repayment counter
    state.repaymentCounter++;
    
    return { type: 'ok', value: true };
  },
  
  markLoanDefaulted: (sender, loanId) => {
    if (!state.loans.has(loanId)) {
      return { type: 'err', value: 2 }; // ERR_NOT_FOUND
    }
    
    if (sender !== state.contractOwner) {
      return { type: 'err', value: 1 }; // ERR_UNAUTHORIZED
    }
    
    const loan = state.loans.get(loanId);
    
    if (loan.status !== 'active') {
      return { type: 'err', value: 4 }; // ERR_LOAN_NOT_ACTIVE
    }
    
    loan.status = 'defaulted';
    state.loans.set(loanId, loan);
    
    return { type: 'ok', value: true };
  },
  
  calculateRemainingAmount: (loanId) => {
    if (!state.loans.has(loanId)) {
      return { type: 'err', value: 2 }; // ERR_NOT_FOUND
    }
    
    const loan = state.loans.get(loanId);
    const principalAmount = loan.amount;
    const interestAmount = (principalAmount * loan.interestRate) / 10000;
    const totalDue = principalAmount + interestAmount;
    
    return { type: 'ok', value: totalDue - loan.totalRepaid };
  }
};

describe('Loan Management Contract', () => {
  beforeEach(() => {
    // Reset state before each test
    state.loans.clear();
    state.repayments.clear();
    state.repaymentCounter = 0;
  });
  
  it('should create a loan successfully', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const loanId = 'l123';
    const businessId = 'b123';
    const amount = 100000;
    const interestRate = 500; // 5%
    const termLength = 5000; // blocks
    
    const result = mockFunctions.createLoan(sender, loanId, businessId, amount, interestRate, termLength);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    expect(state.loans.has(loanId)).toBe(true);
    
    const loan = state.loans.get(loanId);
    expect(loan.businessId).toBe(businessId);
    expect(loan.amount).toBe(amount);
    expect(loan.interestRate).toBe(interestRate);
    expect(loan.termLength).toBe(termLength);
    expect(loan.status).toBe('active');
    expect(loan.borrower).toBe(sender);
  });
  
  it('should not create a loan with invalid parameters', () => {
    const sender = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const loanId = 'l123';
    const businessId = 'b123';
    
    // Invalid amount
    let result = mockFunctions.createLoan(sender, loanId, businessId, 0, 500, 5000);
    expect(result.type).toBe('err');
    expect(result.value).toBe(3); // ERR_INVALID_INPUT
    
    // Invalid interest rate
    result = mockFunctions.createLoan(sender, loanId, businessId, 100000, -1, 5000);
    expect(result.type).toBe('err');
    expect(result.value).toBe(3); // ERR_INVALID_INPUT
    
    // Invalid term length
    result = mockFunctions.createLoan(sender, loanId, businessId, 100000, 500, 0);
    expect(result.type).toBe('err');
    expect(result.value).toBe(3); // ERR_INVALID_INPUT
  });
  
  it('should make a repayment successfully', () => {
    const borrower = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const loanId = 'l123';
    const businessId = 'b123';
    
    // Create loan
    mockFunctions.createLoan(borrower, loanId, businessId, 100000, 500, 5000);
    
    // Make repayment
    const result = mockFunctions.makeRepayment(borrower, loanId, 50000);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    
    // Check loan was updated
    const loan = state.loans.get(loanId);
    expect(loan.totalRepaid).toBe(50000);
    expect(loan.status).toBe('active'); // Not fully repaid yet
    
    // Check repayment was recorded
    const repaymentKey = `${loanId}-0`;
    expect(state.repayments.has(repaymentKey)).toBe(true);
    
    const repayment = state.repayments.get(repaymentKey);
    expect(repayment.amount).toBe(50000);
    expect(repayment.payer).toBe(borrower);
  });
  
  it('should mark loan as repaid when fully repaid', () => {
    const borrower = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const loanId = 'l123';
    const businessId = 'b123';
    const amount = 100000;
    
    // Create loan
    mockFunctions.createLoan(borrower, loanId, businessId, amount, 500, 5000);
    
    // Make full repayment
    mockFunctions.makeRepayment(borrower, loanId, amount);
    
    // Check loan status
    const loan = state.loans.get(loanId);
    expect(loan.status).toBe('repaid');
  });
  
  it('should mark loan as defaulted', () => {
    const borrower = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const loanId = 'l123';
    const businessId = 'b123';
    
    // Create loan
    mockFunctions.createLoan(borrower, loanId, businessId, 100000, 500, 5000);
    
    // Mark as defaulted
    const result = mockFunctions.markLoanDefaulted(state.contractOwner, loanId);
    
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
    
    // Check loan status
    const loan = state.loans.get(loanId);
    expect(loan.status).toBe('defaulted');
  });
  
  it('should calculate remaining amount correctly', () => {
    const borrower = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const loanId = 'l123';
    const businessId = 'b123';
    const amount = 100000;
    const interestRate = 500; // 5%
    
    // Create loan
    mockFunctions.createLoan(borrower, loanId, businessId, amount, interestRate, 5000);
    
    // Make partial repayment
    mockFunctions.makeRepayment(borrower, loanId, 50000);
    
    // Calculate remaining amount
    const result = mockFunctions.calculateRemainingAmount(loanId);
    
    expect(result.type).toBe('ok');
    // Principal + Interest - Repaid = 100000 + (100000 * 5%) - 50000 = 105000 - 50000 = 55000
    expect(result.value).toBe(55000);
  });
});
