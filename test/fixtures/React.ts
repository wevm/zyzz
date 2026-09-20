/** Supplies a production React application with packed variants and source bindings. @module */
import * as Solid from './Solid.js'

/** React uses the same visual and type contract with native React props. */
export const files = {
  'App.tsx': `import {useEffect,useState} from 'react';import {styles,theme,variant} from './styles';
export function App(){const [expanded,setExpanded]=useState(false);useEffect(()=>{document.documentElement.dataset.ready='true'},[]);return <main style={{width:'400px'}}><section className={theme().className} style={{colorScheme:expanded?'dark':'light'}}>
<div id="card" {...styles.card({width:expanded?'75%':'25%',...(expanded?{}:{style:{marginTop:'12px',opacity:0.5,'--note':'"<&>"'}})})}>Card</div>
<div id="variant" {...variant(expanded)}>Variant</div><button id="toggle" onClick={()=>setExpanded(value=>!value)}>Toggle</button></section></main>}`,
  'client.tsx': `import {hydrateRoot} from 'react-dom/client';import {App} from './App';const original=document.querySelector('#card');const root=hydrateRoot(document.querySelector('#app')!,<App/>);document.documentElement.dataset.identity=String(original===document.querySelector('#card'));document.querySelector('#dispose')!.addEventListener('click',()=>root.unmount());`,
  'server.tsx': `import {renderToString} from 'react-dom/server';import {App} from './App';export function render(){return {html:renderToString(<App/>),script:''}}`,
  'styles.ts': Solid.files['styles.ts'].replace(
    "output: 'html'",
    "output: 'react'",
  ),
  'types.tsx': Solid.files['types.tsx'],
}
