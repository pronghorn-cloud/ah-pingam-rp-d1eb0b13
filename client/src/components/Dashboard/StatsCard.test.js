/**
 * StatsCard Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import StatsCard from './StatsCard';

describe('StatsCard Component', () => {
  const defaultProps = {
    title: 'Test Metric',
    value: 100,
    icon: '📊'
  };

  test('renders with required props', () => {
    render(<StatsCard {...defaultProps} />);
    
    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  test('renders with change indicator', () => {
    render(
      <StatsCard 
        {...defaultProps} 
        change="+10% from yesterday"
        changeType="positive"
      />
    );
    
    expect(screen.getByText('+10% from yesterday')).toBeInTheDocument();
  });

  test('renders with subtext', () => {
    render(
      <StatsCard 
        {...defaultProps} 
        subtext="3 critical"
      />
    );
    
    expect(screen.getByText('3 critical')).toBeInTheDocument();
  });

  test('applies color class', () => {
    const { container } = render(
      <StatsCard {...defaultProps} color="success" />
    );
    
    expect(container.querySelector('.stats-card-success')).toBeInTheDocument();
  });

  test('renders string values', () => {
    render(<StatsCard title="Response Time" value="45ms" icon="⚡" />);
    
    expect(screen.getByText('45ms')).toBeInTheDocument();
  });
});
