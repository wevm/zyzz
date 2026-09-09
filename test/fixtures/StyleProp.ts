/**
 * Exercises static style transport through real React component boundaries.
 * @module
 */
/** JSX shared by server and browser rendering scenarios. */
export const source = `import { style as define, Theme } from 'zyzz';
const theme = Theme.define({color:{brand:'#06c'}});
const styles = { button: define({ color: '#06c', padding: '16px' }) };
const alias = styles.button;
function Button(props) { return <button {...props} /> }
function Label({ style, ...rest }) { return <span style={style} {...rest} /> }
let evaluations = 0;
const props = () => { evaluations++; return { id: 'button', className: 'external', title: 'forwarded' } };
export function Example() { return (<>
  <Button style={alias} {...props()}>Continue</Button>
  <Label id="label" style={{ ...styles.button, padding: '24px' }}>Label</Label>
  <section id="theme" style={{ ...theme, colorScheme: 'light dark' }}>Themed</section>
  <div id="plain" style={{ padding: '3px' }} title="A &amp; B" />
  <div id="conditional" style={true ? styles.button : undefined} />
  <div id="inline" style={define({ opacity: 0.5 })} />
  <div id="count" data-count={evaluations} />
</>); }`
