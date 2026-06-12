import nextConfig from 'eslint-config-next/core-web-vitals'

export default [
  ...nextConfig,
  {
    rules: {
      // React Compiler rules (react-hooks v7) — flag valid patterns used throughout
      // this codebase (router.push in effects, accumulator vars in .map, etc).
      // These require React Compiler opt-in to be meaningful.
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/hooks': 'off',
      'react-hooks/capitalized-calls': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/void-use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/memo-dependencies': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/no-deriving-state-in-effects': 'off',
      'react-hooks/memoized-effect-dependencies': 'off',
      'react-hooks/exhaustive-effect-dependencies': 'off',
      // Apostrophes in JSX text are safe — disable entity-escaping requirement
      'react/no-unescaped-entities': 'off',
      // next/image preferred but <img> is used for dynamic external logo URLs
      '@next/next/no-img-element': 'warn',
    },
  },
]
