/**
 * Provides container and field sizing input for real compiler workflows.
 * @module
 */
export const source = `import { css } from 'zyzz';
export const container=css({containerType:['normal','inline-size!'],width:'200px'})();
export const field=css({fieldSizing:'content',interpolateSize:'allow-keywords'})();`
