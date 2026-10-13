import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderEmail } from '../../../src/email/renderer.js';

describe('Email renderer', () => {
  it('Should_compile_react_element_to_both_html_and_plaintext', async () => {
    const element = React.createElement('p', null, 'Transit alert notification');

    const { html, text } = await renderEmail(element);

    expect(html).toContain('Transit alert notification');
    expect(text).toContain('Transit alert notification');
  });
});
