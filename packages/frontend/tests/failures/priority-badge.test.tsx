import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PriorityBadge } from '../../src/features/failures/components/PriorityBadge';

// Wrap in MantineProvider as Badge requires it
function renderBadge(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('PriorityBadge', () => {
  it('renders null for UNKNOWN priority — no badge text in DOM', () => {
    const { container } = renderBadge(<PriorityBadge priority="UNKNOWN" />);
    // MantineProvider injects a style tag, but no badge element should be present
    expect(container.querySelector('.mantine-Badge-root')).toBeNull();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('renders Blocker label for BLOCKER priority', () => {
    renderBadge(<PriorityBadge priority="BLOCKER" />);
    expect(screen.getByText('Blocker')).toBeInTheDocument();
  });

  it('renders Actionable label for ACTIONABLE priority', () => {
    renderBadge(<PriorityBadge priority="ACTIONABLE" />);
    expect(screen.getByText('Actionable')).toBeInTheDocument();
  });

  it('renders Flaky label for FLAKY priority', () => {
    renderBadge(<PriorityBadge priority="FLAKY" />);
    expect(screen.getByText('Flaky')).toBeInTheDocument();
  });

  it('renders Infra label for INFRA priority', () => {
    renderBadge(<PriorityBadge priority="INFRA" />);
    expect(screen.getByText('Infra')).toBeInTheDocument();
  });

  it('hides text label when showLabel=false and sets aria-label instead', () => {
    renderBadge(<PriorityBadge priority="BLOCKER" showLabel={false} />);
    // Label text should not appear
    expect(screen.queryByText('Blocker')).not.toBeInTheDocument();
    // Badge root element should have aria-label set
    const element = document.querySelector('[aria-label="Priority: Blocker"]');
    expect(element).toBeTruthy();
  });

  it('applies blocker CSS class for BLOCKER priority', () => {
    const { container } = renderBadge(<PriorityBadge priority="BLOCKER" />);
    // The badge root element should have the blocker class from the CSS module
    const badgeRoot = container.querySelector('[class*="blocker"]');
    expect(badgeRoot).toBeTruthy();
  });

  it('does NOT apply blocker CSS class for non-BLOCKER priorities', () => {
    const { container } = renderBadge(<PriorityBadge priority="ACTIONABLE" />);
    const badgeRoot = container.querySelector('[class*="blocker"]');
    expect(badgeRoot).toBeNull();
  });
});
