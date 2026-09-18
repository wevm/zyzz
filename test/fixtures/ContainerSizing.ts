/**
 * Provides container and field sizing input for real compiler workflows.
 * @module
 */
export const source = `import { style } from 'zyzz';
export const container=style({containerType:['normal','inline-size !important'],width:'200px'})();
export const field=style({fieldSizing:'content',interpolateSize:'allow-keywords'})();`
