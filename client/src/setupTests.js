/**
 * Jest Setup for React Testing
 */

import '@testing-library/jest-dom';

// Mock window.matchMedia
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};

// Mock ResizeObserver
window.ResizeObserver = window.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: () => null,
  Doughnut: () => null,
  Bar: () => null
}));
