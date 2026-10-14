import { render } from '@react-email/render';
import type React from 'react';

export interface RenderResult {
  html: string;
  text: string;
}

export async function renderEmail(element: React.ReactElement): Promise<RenderResult> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}
