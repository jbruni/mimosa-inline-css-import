mimosa-inline-css-import
===========

## Overview

This is a CSS import inliner module for the Mimosa build tool. It will inline your CSS `@import` code into your stylesheet.

For more information regarding Mimosa, see http://mimosa.io.

## Usage

Add `'inline-css-import'` to your list of modules.  That's all!  Mimosa will install the module for you when you start `mimosa watch` or `mimosa build`.

## Functionality

This module will run inline the contents of your @import clauses over your CSS during `mimosa watch` and `mimosa build`.  It will rewrite the CSS to include the imported files into the stylesheet containing the `@import` clause.

## Default Config

```javascript
"inlineCSSimport": {
  exclude: []
}
```

* `exclude`: list of files to exclude inlining of imported stylesheets.
