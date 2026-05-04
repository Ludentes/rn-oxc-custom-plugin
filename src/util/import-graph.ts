export interface ImportFacts {
  importsFrom: (source: string) => boolean
  namedImportLocalNames: (source: string) => Set<string>
  namespaceImportName: (source: string) => string | null
  defaultImportName: (source: string) => string | null
}

export function collectImportFacts(): {
  facts: ImportFacts
  visitor: { ImportDeclaration(node: any): void }
} {
  const named = new Map<string, Set<string>>()
  const namespace = new Map<string, string>()
  const defaultName = new Map<string, string>()
  return {
    facts: {
      importsFrom: (source) =>
        named.has(source) || namespace.has(source) || defaultName.has(source),
      namedImportLocalNames: (source) => named.get(source) ?? new Set(),
      namespaceImportName: (source) => namespace.get(source) ?? null,
      defaultImportName: (source) => defaultName.get(source) ?? null,
    },
    visitor: {
      ImportDeclaration(node: any) {
        const source = node.source?.value
        if (typeof source !== 'string') return
        for (const spec of node.specifiers ?? []) {
          if (spec.type === 'ImportSpecifier') {
            if (!named.has(source)) named.set(source, new Set())
            named.get(source)!.add(spec.local.name)
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            namespace.set(source, spec.local.name)
          } else if (spec.type === 'ImportDefaultSpecifier') {
            defaultName.set(source, spec.local.name)
          }
        }
      },
    },
  }
}
