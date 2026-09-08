# FAQ

## Is Config Required?

No. Root `css` uses literal values without built-in tokens. Config binds token and layer inference when those contracts are needed.

## Does Config Compile?

No. The source transform replaces style definitions. Importing config does not make untransformed authoring executable.

## Are Tokens Bundled?

Core imports are token-free. The optional `zyzz/themes/default` entrypoint is planned separately.

## Why a Callback?

Callbacks describe typed value bindings to precompiled rules. They do not generate CSS during rendering.

## Can Libraries Precompile?

Yes: distribute matching transformed code and CSS. The current compiler APIs support their documented literal boundary; public CLI packaging remains a preview.

## Does Native Support Everything?

No. Shared definitions require explicit target capabilities. DOM relationships, CSS layers, and global styles are web semantics.
