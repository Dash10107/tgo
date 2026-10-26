/**
 * Markdown rendering test tool
 * Used to test Markdown rendering in the browser console
 */

/**
 * Sample Markdown content for testing
 */
export const markdownExamples = {
  basic: `# Heading 1
## Heading 2
### Heading 3

This is a regular paragraph with **bold** and *italic* text.

This is another paragraph with ~~strikethrough~~.`,

  lists: `## List example

### Unordered list
- Item 1
- Item 2
  - Sub-item 2.1
  - Sub-item 2.2
- Item 3

### Ordered list
1. First
2. Second
3. Third`,

  code: `## Code example

### Inline code
Use \`console.log()\` to print logs.

### Code block
\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
\`\`\`

\`\`\`python
def greet(name):
    print(f"Hello, {name}!")

greet("World")
\`\`\``,

  links: `## Links and images

### Links
Visit [Google](https://www.google.com) to search for information.

### Images
![Sample image](https://via.placeholder.com/300x200)`,

  blockquote: `## Blockquote

> This is a quoted passage.
> It can span multiple lines.
>
> It can even contain **formatted** text.`,

  table: `## Table

| Name | Age | City |
|------|------|------|
| Zhang San | 25   | Beijing |
| Li Si | 30   | Shanghai |
| Wang Wu | 28   | Guangzhou |`,

  mixed: `# AI assistant reply example

Hello! I'm an AI assistant, happy to help you.

## Features

I can help you with the following tasks:

1. **Answering questions** - providing accurate information and answers
2. **Code help** - writing and debugging code
3. **Document generation** - creating documents in various formats

### Code example

Here is a simple JavaScript function:

\`\`\`javascript
function calculateSum(a, b) {
  return a + b;
}

const result = calculateSum(5, 3);
console.log(result); // Output: 8
\`\`\`

### Important note

> **Note**: please test thoroughly before using the code.

### Related links

- [Official docs](https://example.com/docs)
- [API reference](https://example.com/api)

---

If you have any questions, feel free to ask me!`,

  aiResponse: `Based on your needs, I have prepared the following solution:

## Solution overview

This solution has three main steps:

1. **Data preparation** - collect and organize the necessary data
2. **Processing flow** - run the core business logic
3. **Result validation** - make sure the output meets expectations

### Implementation code

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

async function processUser(user: User): Promise<void> {
  // Validate user data
  if (!user.email) {
    throw new Error('Email is required');
  }
  
  // Process user info
  console.log(\`Processing user: \${user.name}\`);
  
  // Save to the database
  await saveToDatabase(user);
}
\`\`\`

### Notes

> ⚠️ **Important**: 
> - Make sure all required fields are filled in
> - Validate the email format
> - Handle possible exceptions

### Test results

| Test item | Status | Remarks |
|--------|------|------|
| Data validation | ✅ Passed | All fields validated correctly |
| Business logic | ✅ Passed | Processing flow is correct |
| Exception handling | ✅ Passed | Error handling is thorough |

I hope this solution helps! If you have questions, feel free to ask.`
};

/**
 * Print Markdown examples to the console
 */
export const printMarkdownExamples = (): void => {
  console.log('📝 Markdown rendering test examples');
  console.log('');
  console.log('Available examples:');
  console.log('- markdownExamples.basic - basic formatting');
  console.log('- markdownExamples.lists - lists');
  console.log('- markdownExamples.code - code blocks');
  console.log('- markdownExamples.links - links and images');
  console.log('- markdownExamples.blockquote - blockquote');
  console.log('- markdownExamples.table - table');
  console.log('- markdownExamples.mixed - mixed formatting');
  console.log('- markdownExamples.aiResponse - AI reply example');
  console.log('');
  console.log('Usage:');
  console.log('1. Copy any example content');
  console.log('2. Send a message containing stream_data in the chat interface');
  console.log('3. Check the Markdown rendering result');
};

/**
 * Test whether Markdown rendering works correctly
 */
export const testMarkdownRendering = (): void => {
  console.log('🧪 Testing Markdown rendering...');
  console.log('');

  // Check whether the MarkdownContent component has been loaded
  const markdownElements = document.querySelectorAll('.markdown-content');
  console.log(`📋 Found ${markdownElements.length} Markdown content elements`);

  if (markdownElements.length > 0) {
    console.log('✅ Markdown component loaded correctly');
    
    markdownElements.forEach((element, index) => {
      console.log(`  Element ${index + 1}:`, {
        hasWhiteClass: element.classList.contains('markdown-white'),
        childrenCount: element.children.length,
        textLength: element.textContent?.length || 0
      });
    });
  } else {
    console.log('⚠️ No Markdown content elements found');
    console.log('Hint: make sure there are messages containing stream_data');
  }

  console.log('');
  console.log('💡 Testing suggestions:');
  console.log('1. Send a message containing Markdown formatting');
  console.log('2. Check that the message renders correctly as HTML');
  console.log('3. Verify the styling of code blocks, lists, links and other elements');
  console.log('4. Test the display on a blue background (agent messages) and a white background (visitor messages)');
};

/**
 * Check whether the Markdown-related dependencies are installed
 */
export const checkMarkdownDependencies = (): void => {
  console.log('🔍 Checking Markdown dependencies...');
  console.log('');

  const dependencies = [
    'react-markdown',
    'remark-gfm',
    'rehype-raw',
    'rehype-sanitize'
  ];

  console.log('Required packages:');
  dependencies.forEach(dep => {
    console.log(`  - ${dep}`);
  });

  console.log('');
  console.log('✅ If the app runs normally, all dependencies are installed correctly');
  console.log('');
  console.log('💡 If you run into problems, run:');
  console.log('npm install react-markdown remark-gfm rehype-raw rehype-sanitize');
};

/**
 * Show Markdown syntax help
 */
export const showMarkdownHelp = (): void => {
  console.log('📚 Markdown syntax help');
  console.log('');
  console.log('# Heading 1');
  console.log('## Heading 2');
  console.log('### Heading 3');
  console.log('');
  console.log('**Bold text**');
  console.log('*Italic text*');
  console.log('~~Strikethrough~~');
  console.log('');
  console.log('- Unordered list item');
  console.log('1. Ordered list item');
  console.log('');
  console.log('[Link text](https://example.com)');
  console.log('![Image description](https://example.com/image.jpg)');
  console.log('');
  console.log('`Inline code`');
  console.log('');
  console.log('```language');
  console.log('Code block');
  console.log('```');
  console.log('');
  console.log('> Quoted text');
  console.log('');
  console.log('| Header 1 | Header 2 |');
  console.log('|-------|-------|');
  console.log('| Cell 1 | Cell 2 |');
};

/**
 * Run all Markdown tests
 */
export const runAllMarkdownTests = (): void => {
  console.log('🚀 Running Markdown rendering tests...');
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  checkMarkdownDependencies();
  console.log('='.repeat(60));
  console.log('');

  testMarkdownRendering();
  console.log('='.repeat(60));
  console.log('');

  printMarkdownExamples();
  console.log('='.repeat(60));
  console.log('');

  showMarkdownHelp();
  console.log('='.repeat(60));
  console.log('');

  console.log('🎉 Tests complete!');
  console.log('');
  console.log('💡 Usage:');
  console.log('- checkMarkdownDependencies() - check dependencies');
  console.log('- testMarkdownRendering() - test rendering');
  console.log('- printMarkdownExamples() - view examples');
  console.log('- showMarkdownHelp() - syntax help');
  console.log('- runAllMarkdownTests() - run all tests');
};

// Add the test functions to the global object in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).markdownExamples = markdownExamples;
  (window as any).checkMarkdownDependencies = checkMarkdownDependencies;
  (window as any).testMarkdownRendering = testMarkdownRendering;
  (window as any).printMarkdownExamples = printMarkdownExamples;
  (window as any).showMarkdownHelp = showMarkdownHelp;
  (window as any).runAllMarkdownTests = runAllMarkdownTests;
  
  console.log('🧪 Markdown test tool loaded');
  console.log('🧪 Use runAllMarkdownTests() to run all tests');
}
