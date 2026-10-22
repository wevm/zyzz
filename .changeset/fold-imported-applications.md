---
'zyzz': patch
---

Production graph compiles fold applications of imported styles as they fold local ones. A `cx` call or a no-argument application spread alone onto a DOM element becomes a `className` attribute, chosen by a conditional or from a string table, instead of a spread of frozen props. Imports whose modules evaluate first drop their initialization reads, so bundlers remove definitions that no other code reads along with their runtime. A folded import becomes a bare import, which keeps the imported module and its stylesheet.
