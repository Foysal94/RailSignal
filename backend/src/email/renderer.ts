import type React from 'react';
import { render } from '@react-email/render';

export interface RenderResult {
  html: string;
  text: string;
}

/**
 * Pure compiler that converts a React email element to both HTML
 * and plain-text formats for dual-content delivery.
 */
export async function renderEmail(element: React.ReactElement): Promise<RenderResult> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}
