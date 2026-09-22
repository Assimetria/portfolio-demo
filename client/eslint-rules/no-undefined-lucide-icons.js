'use strict';

/**
 * ESLint rule: no-undefined-lucide-icons
 *
 * Flags named imports and re-exports from 'lucide-react' whose names are not
 * present in the installed version of the package. This catches typos and icon
 * renames before they reach production as console errors.
 *
 * Covers:
 *   import { X }   from 'lucide-react'          (ImportDeclaration)
 *   export { X }   from 'lucide-react'          (ExportNamedDeclaration)
 *
 * Refs: #19642 #19633 #19661
 */

let _lucideExports = undefined;
let _lucideVersion = 'unknown';

function getLucideExports() {
  if (_lucideExports !== undefined) return _lucideExports;
  try {
    _lucideExports = new Set(Object.keys(require('lucide-react')));
    try {
      _lucideVersion = require('lucide-react/package.json').version;
    } catch {}
  } catch {
    // lucide-react not installed in this environment; skip validation
    _lucideExports = null;
  }
  return _lucideExports;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Flag named imports from lucide-react that do not exist in the installed package',
    },
    messages: {
      undefinedIcon:
        '"{{ name }}" is not exported by lucide-react@{{ version }}. ' +
        'Check the icon name or update the package.',
    },
    schema: [],
  },

  create(context) {
    const lucideExports = getLucideExports();

    function checkSpecifier(specifier) {
      if (!lucideExports) return; // package unavailable — skip silently

      const isImport = specifier.type === 'ImportSpecifier';
      const isExport = specifier.type === 'ExportSpecifier';
      if (!isImport && !isExport) return;

      // Skip TypeScript type-only specifiers (stripped at compile time)
      if (specifier.importKind === 'type' || specifier.exportKind === 'type') return;

      // For import { X }, the name is specifier.imported.name
      // For export { X } from '...', the name is specifier.local.name
      const iconName = isImport ? specifier.imported.name : specifier.local.name;

      if (!lucideExports.has(iconName)) {
        context.report({
          node: specifier,
          messageId: 'undefinedIcon',
          data: { name: iconName, version: _lucideVersion },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'lucide-react') return;
        node.specifiers.forEach(checkSpecifier);
      },

      ExportNamedDeclaration(node) {
        if (!node.source || node.source.value !== 'lucide-react') return;
        // Skip `export type { ... } from 'lucide-react'`
        if (node.exportKind === 'type') return;
        node.specifiers.forEach(checkSpecifier);
      },
    };
  },
};
