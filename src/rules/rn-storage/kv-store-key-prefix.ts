import type { Rule } from 'eslint'
import { collectImportFacts } from '../../util/import-graph.ts'

const MOBILE_PATH = /\/apps\/mobile\//
const KV_SOURCE = 'expo-sqlite/kv-store'
const KV_FNS = new Set([
  'setItem',
  'getItem',
  'removeItem',
  'setItemAsync',
  'getItemAsync',
  'removeItemAsync',
])

interface Options {
  /** Regex source (anchored or not). E.g. "^myapp:v\\d+:". */
  prefix?: string
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a configured pattern on expo-sqlite/kv-store keys. Configure via options: `{ prefix: "^myapp:[\\\\w-]+:v\\\\d+$" }`. No-op without options. Conventional shape is `<app>:<feature>:v<n>` (e.g. `ne:tq-cache:v1`).',
    },
    messages: { badPrefix: 'kv-store key "{{key}}" must match the prefix /{{ pattern }}/.' },
    schema: [
      {
        type: 'object',
        properties: { prefix: { type: 'string' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const opts = (context.options[0] ?? {}) as Options
    if (!opts.prefix) return {}
    let pattern: RegExp
    try {
      pattern = new RegExp(opts.prefix)
    } catch {
      return {}
    }
    const filename = (context.filename ?? '').replaceAll('\\', '/')
    if (!MOBILE_PATH.test(filename)) return {}
    const { facts, visitor } = collectImportFacts()

    function checkCall(node: any, fnName: string) {
      if (!KV_FNS.has(fnName)) return
      const arg = node.arguments?.[0]
      if (arg?.type !== 'Literal' || typeof arg.value !== 'string') return
      if (!pattern.test(arg.value)) {
        context.report({
          node: arg,
          messageId: 'badPrefix',
          data: { key: arg.value, pattern: opts.prefix! },
        })
      }
    }

    return {
      ...visitor,
      CallExpression(node: any) {
        if (!facts.importsFrom(KV_SOURCE)) return
        const callee = node.callee
        if (callee?.type === 'Identifier') {
          if (facts.namedImportLocalNames(KV_SOURCE).has(callee.name)) {
            checkCall(node, callee.name)
          }
        } else if (callee?.type === 'MemberExpression') {
          const ns = facts.namespaceImportName(KV_SOURCE)
          const def = facts.defaultImportName(KV_SOURCE)
          if (
            callee.object?.type === 'Identifier' &&
            (callee.object.name === ns || callee.object.name === def) &&
            callee.property?.type === 'Identifier'
          ) {
            checkCall(node, callee.property.name)
          }
        }
      },
    }
  },
}

export default rule
