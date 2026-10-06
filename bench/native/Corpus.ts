/** Defines matched authoring and native layout workloads for all three libraries. @module */
export const libraries = ['stylesheet', 'unistyles', 'zyzz'] as const
export type Library = (typeof libraries)[number]
export const kinds = [
  'repeated',
  'unique',
  'dynamic',
  'variants',
  'theme',
] as const
export type Kind = (typeof kinds)[number]
export const counts = [10, 100, 1000] as const
export type Case = { count: number; kind: Kind }

/** Matches the 400 theme values `app/Setup.ts` gives Unistyles, so cold starts include realistic config work. */
function tokens(cell: string) {
  const color = Object.fromEntries(
    Array.from({ length: 200 }, (_, index) => [
      `c${index}`,
      `#${((index + 1) * 7919).toString(16).padStart(6, '0')}`,
    ]),
  )
  const spacing = Object.fromEntries(
    Array.from({ length: 199 }, (_, index) => [`s${index}`, `${index}px`]),
  )
  return JSON.stringify({ color, spacing: { cell, ...spacing } })
}

/** Emits ordinary component source using each library's public authoring API. */
export function source(library: Library, workload: Case, edited = false) {
  const height = edited ? 5 : 4
  const definitions = workload.count
  const themed = workload.kind === 'theme'
  const dynamic = workload.kind === 'dynamic'
  const variants = workload.kind === 'variants'
  const header =
    library === 'zyzz'
      ? themed
        ? `import { defineConfig } from 'zyzz/react-native';
       const { Provider, style: themedStyle } = defineConfig({defaultVars:'base',vars:{base:${tokens('2px')},alternate:${tokens('6px')}}});`
        : `import { ${variants ? 'variants' : 'style'} } from 'zyzz';
       import { Provider } from 'zyzz/react-native/react';`
      : `import { StyleSheet } from '${library === 'unistyles' ? 'react-native-unistyles' : 'react-native'}';`
  const styles = Array.from({ length: definitions }, (_, index) => {
    const width = 12 + (workload.kind === 'unique' ? index % 13 : 0)
    const color =
      workload.kind === 'unique'
        ? `#${((index + 1) * 7919).toString(16).padStart(6, '0')}`
        : '#2563eb'
    const base = { backgroundColor: color, height, width }
    if (library === 'zyzz') {
      const literal = { ...base, height: `${height}px`, width: `${width}px` }
      if (dynamic)
        return `const s${index} = style((v: {width: \`\${number}px\`}) => ({...${JSON.stringify(literal)},width:v.width}));`
      if (variants)
        return `const s${index} = variants({base:${JSON.stringify(literal)},variants:{active:{false:{width:'12px'},true:{width:'24px'}}}});`
      if (themed)
        return `const s${index} = themedStyle({padding:'cell',backgroundColor:'#2563eb !custom',width:'${edited ? 25 : 24}px !custom'});`
      return `const s${index} = style(${JSON.stringify(literal)});`
    }
    if (dynamic)
      return `s${index}: (width: number) => ({...${JSON.stringify(base)},width}),`
    if (variants && library === 'unistyles')
      return `s${index}: {...${JSON.stringify(base)},variants:{active:{false:{width:12},true:{width:24}}}},`
    if (themed)
      return `s${index}: {width:${edited ? 25 : 24},padding:theme.padding,backgroundColor:'#2563eb'},`
    return `s${index}: ${JSON.stringify(base)},`
  }).join('\n')
  const declaration =
    library === 'zyzz'
      ? styles
      : dynamic && library === 'stylesheet'
        ? `const styles = {${styles}};`
        : themed && library === 'stylesheet'
          ? `const base = StyleSheet.create((theme => ({${styles}}))({padding:2}));
           const alternate = StyleSheet.create((theme => ({${styles}}))({padding:6}));`
          : `const styles = StyleSheet.create(${themed ? 'theme => ' : ''}({${styles}}));`
  const expressions = Array.from({ length: definitions }, (_, index) => {
    if (library === 'zyzz')
      return `s${index}(${dynamic ? "{width: active ? '24px' : '12px'}" : variants ? '{active}' : ''}).style`
    if (themed && library === 'stylesheet')
      return `(active ? alternate : base).s${index}`
    if (variants && library === 'stylesheet')
      return `[styles.s${index}, {width:active ? 24 : 12}]`
    return `styles.s${index}${dynamic ? '(active ? 24 : 12)' : ''}`
  })
  return `${header}
    import React from 'react';
    import { View } from 'react-native';
    ${declaration}
    export function Cell({index, active, onLayout}: {index:number;active:boolean;onLayout:(event:import('react-native').LayoutChangeEvent)=>void}) {
      ${variants && library === 'unistyles' ? 'styles.useVariants({active});' : ''}
      switch (index % ${definitions}) {
        ${expressions.map((value, index) => `case ${index}: return <View collapsable={false} onLayout={onLayout} style={${value} as import('react-native').StyleProp<import('react-native').ViewStyle>} />;`).join('\n')}
      }
      throw new Error('Invalid native fixture index');
    }
    export function Scope({active,children,onTheme}: {active:boolean;children:React.ReactNode;onTheme:(update:(active:boolean)=>void)=>void}) {
      ${
        library === 'zyzz' && themed
          ? `// Owns the selection so a theme change updates native views without re-rendering cells, as Unistyles does.
      const [current, setCurrent] = React.useState(active);
      React.useLayoutEffect(() => onTheme(setCurrent), [onTheme]);
      return <Provider vars={current ? 'alternate' : 'base'} colorScheme="light">{children}</Provider>;`
          : `return ${library === 'zyzz' ? '<Provider colorScheme="light">{children}</Provider>' : '<>{children}</>'};`
      }
    }
  `
}
