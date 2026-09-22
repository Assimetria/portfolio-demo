// Transforms import.meta.env → globalThis.__IMPORT_META_ENV__ for Jest compatibility
module.exports = function importMetaBabelPlugin() {
  return {
    visitor: {
      MetaProperty(path) {
        if (path.node.meta.name !== 'import' || path.node.property.name !== 'meta') return
        const parent = path.parentPath
        if (!parent.isMemberExpression()) return
        if (parent.node.property.name === 'env') {
          parent.replaceWithSourceString('globalThis.__IMPORT_META_ENV__')
        }
      },
    },
  }
}
