/**
 * Markdown rendering validation tool
 * Automatically tests and validates that Markdown rendering works correctly
 */

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface ValidationReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: Array<{
    category: string;
    test: string;
    result: ValidationResult;
  }>;
}

/**
 * Validate that the Markdown component has been loaded
 */
export const validateMarkdownComponentLoaded = (): ValidationResult => {
  try {
    const markdownElements = document.querySelectorAll('.markdown-content');
    
    if (markdownElements.length > 0) {
      return {
        passed: true,
        message: `Found ${markdownElements.length} Markdown content elements`,
        details: {
          count: markdownElements.length,
          elements: Array.from(markdownElements).map((el, i) => ({
            index: i,
            hasWhiteClass: el.classList.contains('markdown-white'),
            childrenCount: el.children.length
          }))
        }
      };
    } else {
      return {
        passed: false,
        message: 'No Markdown content elements found; there may be no messages containing stream_data',
        details: { hint: 'Make sure there are messages containing stream_data on the page' }
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Validate that the Markdown styles are loaded correctly
 */
export const validateMarkdownStyles = (): ValidationResult => {
  try {
    // Check whether there are style rules from markdown.css
    const styleSheets = Array.from(document.styleSheets);
    let hasMarkdownStyles = false;
    
    for (const sheet of styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        const markdownRules = rules.filter(rule => 
          rule.cssText.includes('markdown-content') || 
          rule.cssText.includes('markdown-white')
        );
        
        if (markdownRules.length > 0) {
          hasMarkdownStyles = true;
          break;
        }
      } catch (e) {
    // CORS restriction; skip external stylesheets
        continue;
      }
    }
    
    if (hasMarkdownStyles) {
      return {
        passed: true,
        message: 'Markdown styles loaded correctly',
        details: { stylesFound: true }
      };
    } else {
      return {
        passed: false,
        message: 'Markdown styles may not be loaded correctly',
        details: { 
          hint: 'Check whether src/styles/markdown.css is imported in src/index.css',
          stylesFound: false
        }
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Style validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Validate that Markdown elements are rendered correctly
 */
export const validateMarkdownElements = (): ValidationResult => {
  try {
    const markdownContainers = document.querySelectorAll('.markdown-content');
    
    if (markdownContainers.length === 0) {
      return {
        passed: false,
        message: 'No Markdown container found',
        details: { hint: 'Make sure there are messages containing stream_data on the page' }
      };
    }
    
    const foundElements: Record<string, number> = {};
    const elementSelectors = {
      'h1': 'h1',
      'h2': 'h2',
      'h3': 'h3',
      'p': 'p',
      'code': 'code',
      'pre': 'pre',
      'a': 'a',
      'ul': 'ul',
      'ol': 'ol',
      'li': 'li',
      'blockquote': 'blockquote',
      'table': 'table',
      'strong': 'strong',
      'em': 'em'
    };
    
    markdownContainers.forEach(container => {
      Object.entries(elementSelectors).forEach(([name, selector]) => {
        const elements = container.querySelectorAll(selector);
        foundElements[name] = (foundElements[name] || 0) + elements.length;
      });
    });
    
    const foundCount = Object.values(foundElements).reduce((sum, count) => sum + count, 0);
    
    if (foundCount > 0) {
      return {
        passed: true,
        message: `Found ${foundCount} Markdown elements`,
        details: { elements: foundElements }
      };
    } else {
      return {
        passed: false,
        message: 'No elements found in the Markdown container',
        details: { 
          hint: 'The Markdown content may be empty or rendering may have failed',
          foundElements
        }
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Element validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Validate that links have the correct security attributes
 */
export const validateLinkSecurity = (): ValidationResult => {
  try {
    const markdownLinks = document.querySelectorAll('.markdown-content a');
    
    if (markdownLinks.length === 0) {
      return {
        passed: true,
        message: 'No links found (the current content may not contain links)',
        details: { linksCount: 0 }
      };
    }
    
    let allLinksSecure = true;
    const linkDetails: Array<{ href: string; hasTarget: boolean; hasRel: boolean }> = [];
    
    markdownLinks.forEach(link => {
      const hasTarget = link.getAttribute('target') === '_blank';
      const hasRel = link.getAttribute('rel')?.includes('noopener') || false;
      
      linkDetails.push({
        href: link.getAttribute('href') || '',
        hasTarget,
        hasRel
      });
      
      if (!hasTarget || !hasRel) {
        allLinksSecure = false;
      }
    });
    
    if (allLinksSecure) {
      return {
        passed: true,
        message: `All ${markdownLinks.length} links have the correct security attributes`,
        details: { linksCount: markdownLinks.length, links: linkDetails }
      };
    } else {
      return {
        passed: false,
        message: 'Some links are missing security attributes',
        details: { 
          linksCount: markdownLinks.length,
          links: linkDetails,
          hint: 'Links should have target="_blank" and rel="noopener noreferrer"'
        }
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Link security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Validate that code blocks have a language label
 */
export const validateCodeBlocks = (): ValidationResult => {
  try {
    const codeBlocks = document.querySelectorAll('.markdown-content pre');
    
    if (codeBlocks.length === 0) {
      return {
        passed: true,
        message: 'No code blocks found (the current content may not contain code blocks)',
        details: { codeBlocksCount: 0 }
      };
    }
    
    const codeBlockDetails: Array<{ hasLanguageLabel: boolean; content: string }> = [];
    
    codeBlocks.forEach(block => {
      const hasLanguageLabel = block.previousElementSibling?.classList.contains('code-language') ||
                               block.parentElement?.querySelector('.code-language') !== null;
      const content = block.textContent?.substring(0, 50) || '';
      
      codeBlockDetails.push({
        hasLanguageLabel,
        content: content + (content.length >= 50 ? '...' : '')
      });
    });
    
    return {
      passed: true,
      message: `Found ${codeBlocks.length} code blocks`,
      details: { 
        codeBlocksCount: codeBlocks.length,
        blocks: codeBlockDetails
      }
    };
  } catch (error) {
    return {
      passed: false,
      message: `Code block validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Validate white text styling (messages on a blue background)
 */
export const validateWhiteTextStyle = (): ValidationResult => {
  try {
    const whiteMarkdown = document.querySelectorAll('.markdown-white');
    
    if (whiteMarkdown.length === 0) {
      return {
        passed: true,
        message: 'No white-text Markdown found (there may be no AI assistant messages)',
        details: { whiteMarkdownCount: 0 }
      };
    }
    
    const styleDetails: Array<{ hasWhiteClass: boolean; parentBgColor: string }> = [];
    
    whiteMarkdown.forEach(element => {
      const parent = element.closest('.bg-blue-500');
      styleDetails.push({
        hasWhiteClass: element.classList.contains('markdown-white'),
        parentBgColor: parent ? 'blue-500' : 'unknown'
      });
    });
    
    return {
      passed: true,
      message: `Found ${whiteMarkdown.length} white-text Markdown elements`,
      details: { 
        whiteMarkdownCount: whiteMarkdown.length,
        styles: styleDetails
      }
    };
  } catch (error) {
    return {
      passed: false,
      message: `White-text style validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Run all validation tests
 */
export const runAllValidations = (): ValidationReport => {
  console.log('🔍 Running Markdown rendering validation...');
  console.log('');
  
  const tests = [
    { category: 'Component loading', test: 'Markdown component loading', fn: validateMarkdownComponentLoaded },
    { category: 'Style loading', test: 'Markdown style loading', fn: validateMarkdownStyles },
    { category: 'Element rendering', test: 'Markdown element rendering', fn: validateMarkdownElements },
    { category: 'Security', test: 'Link security attributes', fn: validateLinkSecurity },
    { category: 'Code blocks', test: 'Code block rendering', fn: validateCodeBlocks },
    { category: 'Styles', test: 'White text styling', fn: validateWhiteTextStyle }
  ];
  
  const results: ValidationReport['results'] = [];
  let passedTests = 0;
  let failedTests = 0;
  
  tests.forEach(({ category, test, fn }) => {
    console.log(`📋 Test: ${category} - ${test}`);
    const result = fn();
    
    results.push({ category, test, result });
    
    if (result.passed) {
      passedTests++;
      console.log(`  ✅ ${result.message}`);
    } else {
      failedTests++;
      console.log(`  ❌ ${result.message}`);
    }
    
    if (result.details) {
      console.log('  Details:', result.details);
    }
    console.log('');
  });
  
  const report: ValidationReport = {
    totalTests: tests.length,
    passedTests,
    failedTests,
    results
  };
  
  console.log('='.repeat(60));
  console.log(`📊 Validation report: ${passedTests}/${tests.length} tests passed`);
  console.log('='.repeat(60));
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! Markdown rendering is working.');
  } else {
    console.log(`⚠️ ${failedTests} tests failed; please check the details above.`);
  }
  
  return report;
};

// Add the validation functions to the global object in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).validateMarkdownComponentLoaded = validateMarkdownComponentLoaded;
  (window as any).validateMarkdownStyles = validateMarkdownStyles;
  (window as any).validateMarkdownElements = validateMarkdownElements;
  (window as any).validateLinkSecurity = validateLinkSecurity;
  (window as any).validateCodeBlocks = validateCodeBlocks;
  (window as any).validateWhiteTextStyle = validateWhiteTextStyle;
  (window as any).runAllValidations = runAllValidations;
  
  console.log('🔍 Markdown validation tool loaded');
  console.log('🔍 Use runAllValidations() to run all validation tests');
}
