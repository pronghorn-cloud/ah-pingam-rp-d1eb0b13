/**
 * App Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('App Component', () => {
  test('renders without crashing', () => {
    renderApp();
  });

  test('renders sidebar', () => {
    renderApp();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  test('renders header', () => {
    renderApp();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  test('renders PingAM branding', () => {
    renderApp();
    expect(screen.getByText('PingAM')).toBeInTheDocument();
  });

  test('renders navigation links', () => {
    renderApp();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Auth Events')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });
});
