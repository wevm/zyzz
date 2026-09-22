/**
 * Exercises the public style workflow through real collaborating modules.
 * @module
 */
import * as Path from 'node:path'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import * as Ts from 'typescript-api'
import { describe, expect, test } from 'vite-plus/test'
import { Config, Style, style } from 'zyzz'

import { Graph, Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

describe('style', () => {
  test.each([
    ["import { style } from 'zyzz'", ''],
    [
      "import { Config } from 'zyzz'",
      "const { style } = Config.create({ vars: { fontSize: { hero: '72px' }, breakpoints: { tablet: '48rem' } } })",
    ],
    ["import { style } from 'zyzz/default'", ''],
  ])(
    'suggests nested declarations and structural keys through %s',
    (imports, setup) => {
      const root = Path.resolve(import.meta.dirname, '..')
      const file = Path.join(root, '.fixture-nested-editor.ts')
      const source = `${imports}
${setup}
const quoted = style({ '/* key */': {} })
const card = style({
  /* root */
  '@media (min-width: 768px)': {
    /* media */
    fontSize: '/* font */',
    width: '/* width */',
    '::before': {
      /* pseudo */
      display: '/* display */',
    },
  },
})
`
      const options: Ts.CompilerOptions = {
        module: Ts.ModuleKind.ESNext,
        moduleResolution: Ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        paths: {
          zyzz: [Path.join(root, 'src/index.ts')],
          'zyzz/default': [Path.join(root, 'src/default.ts')],
        },
        skipLibCheck: true,
        strict: true,
        target: Ts.ScriptTarget.ESNext,
        types: [],
      }
      const snapshots = new Map<string, Ts.IScriptSnapshot>()
      const service = Ts.createLanguageService({
        fileExists: (path) => path === file || Ts.sys.fileExists(path),
        getCompilationSettings: () => options,
        getCurrentDirectory: () => root,
        getDefaultLibFileName: Ts.getDefaultLibFilePath,
        getScriptFileNames: () => [file],
        getScriptSnapshot: (path) => {
          const cached = snapshots.get(path)
          if (cached) return cached

          const text = path === file ? source : Ts.sys.readFile(path)
          if (text === undefined) return undefined

          const snapshot = Ts.ScriptSnapshot.fromString(text)
          snapshots.set(path, snapshot)
          return snapshot
        },
        getScriptVersion: () => '0',
        readDirectory: Ts.sys.readDirectory,
        readFile: (path) => (path === file ? source : Ts.sys.readFile(path)),
      })

      try {
        for (const marker of ['root', 'media', 'pseudo', 'key']) {
          const names =
            service
              .getCompletionsAtPosition(
                file,
                source.indexOf(`/* ${marker} */`),
                {},
              )
              ?.entries.map((entry) => entry.name.replace(/^"|"$/g, '')) ?? []
          if (marker === 'root') {
            expect(names.includes('::before')).toMatchInlineSnapshot(`true`)
            if (setup)
              expect(names.includes('@media tablet')).toMatchInlineSnapshot(
                `true`,
              )
          }
          expect(
            [
              'fontFamily',
              'height',
              '::after',
              ':hover',
              '@media',
              '@supports',
            ].filter((name) => names.includes(name)),
          ).toMatchInlineSnapshot(`
          [
            "fontFamily",
            "height",
            "::after",
            ":hover",
            "@media",
            "@supports",
          ]
        `)
        }
        for (const [marker, expected] of [
          ['font', 'medium'],
          ['width', 'auto'],
          ['display', 'flex'],
        ]) {
          const names =
            service
              .getCompletionsAtPosition(
                file,
                source.indexOf(`/* ${marker} */`),
                {},
              )
              ?.entries.map((entry) => entry.name.replace(/^"|"$/g, '')) ?? []
          expect(names.includes(expected!)).toMatchInlineSnapshot(`true`)
        }
        if (setup) {
          const names =
            service
              .getCompletionsAtPosition(file, source.indexOf('/* font */'), {})
              ?.entries.map((entry) => entry.name.replace(/^"|"$/g, '')) ?? []
          expect(names.includes('hero')).toMatchInlineSnapshot(`true`)
        }
      } finally {
        service.dispose()
      }
    },
    30_000,
  )

  test('suggests CSS properties and reports invalid declarations on their keys', () => {
    const root = Path.resolve(import.meta.dirname, '..')
    const file = Path.join(root, '.fixture-editor.ts')
    let source = `import { style } from 'zyzz'
const pane = style({
  /* properties */
  alignItems: 'center',
  backgroundColor: 'light-dark(#fff, #171717)',
  border: '1px solid light-dark(#e5e5e5, #303030)',
  display: 'flex',
  selectors: { '&:hover': {

    opacity: 0.5
  } },
})
const dynamic = style((values: { width: \`\${number}px\` }) => ({
  display: 'flex',
  width: values.width,
}))
dynamic({ width: '12px' })
`
    let version = 0
    const snapshots = new Map<string, Ts.IScriptSnapshot>()
    const options: Ts.CompilerOptions = {
      module: Ts.ModuleKind.ESNext,
      moduleResolution: Ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      paths: { zyzz: [Path.join(root, 'src/index.ts')] },
      skipLibCheck: true,
      strict: true,
      target: Ts.ScriptTarget.ESNext,
      types: [],
    }
    const service = Ts.createLanguageService({
      fileExists: (path) => path === file || Ts.sys.fileExists(path),
      getCompilationSettings: () => options,
      getCurrentDirectory: () => root,
      getDefaultLibFileName: Ts.getDefaultLibFilePath,
      getProjectVersion: () => String(version),
      getScriptFileNames: () => [file],
      getScriptSnapshot: (path) => {
        if (path === file) return Ts.ScriptSnapshot.fromString(source)

        const cached = snapshots.get(path)
        if (cached) return cached

        const text = Ts.sys.readFile(path)
        if (text === undefined) return undefined

        const snapshot = Ts.ScriptSnapshot.fromString(text)
        snapshots.set(path, snapshot)
        return snapshot
      },
      getScriptVersion: (path) => (path === file ? String(version) : '0'),
      readDirectory: Ts.sys.readDirectory,
      readFile: (path) => (path === file ? source : Ts.sys.readFile(path)),
    })

    function complete(property: string, original: string, value: string) {
      const previous = source
      source = source.replace(
        `${property}: '${original}'`,
        `${property}: '${value}'`,
      )
      version++
      try {
        const position =
          source.indexOf(`${property}: '${value}'`) +
          `${property}: '`.length +
          value.length
        return service
          .getCompletionsAtPosition(file, position, {})
          ?.entries.map((entry) => entry.name)
      } finally {
        source = previous
        version++
      }
    }

    function diagnose(before: string, after: string) {
      const previous = source
      source = source.replace(before, after)
      version++
      try {
        return service.getSemanticDiagnostics(file).map((diagnostic) => ({
          code: diagnostic.code,
          message: Ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n',
          ),
          span: source.slice(
            diagnostic.start!,
            diagnostic.start! + diagnostic.length!,
          ),
        }))
      } finally {
        source = previous
        version++
      }
    }

    try {
      expect(service.getSemanticDiagnostics(file)).toMatchInlineSnapshot(`[]`)
      const completions = service.getCompletionsAtPosition(
        file,
        source.indexOf('/* properties */'),
        {},
      )
      expect(completions?.entries.map((entry) => entry.name))
        .toMatchInlineSnapshot(`
      [
        ""::after"",
        ""::backdrop"",
        ""::before"",
        ""::first-letter"",
        ""::first-line"",
        ""::marker"",
        ""::placeholder"",
        ""::selection"",
        "":active"",
        "":checked"",
        "":disabled"",
        "":empty"",
        "":enabled"",
        "":first-child"",
        "":focus-visible"",
        "":focus-within"",
        "":focus"",
        "":hover"",
        "":last-child"",
        "":only-child"",
        "":visited"",
        ""@container"",
        ""@layer"",
        ""@media"",
        ""@scope"",
        ""@starting-style"",
        ""@supports"",
        "accentColor",
        "alignContent",
        "alignmentBaseline",
        "alignSelf",
        "alignTracks",
        "all",
        "anchorName",
        "anchorScope",
        "animation",
        "animationComposition",
        "animationDelay",
        "animationDirection",
        "animationDuration",
        "animationFillMode",
        "animationIterationCount",
        "animationName",
        "animationPlayState",
        "animationRange",
        "animationRangeEnd",
        "animationRangeStart",
        "animationTimeline",
        "animationTimingFunction",
        "animationTrigger",
        "appearance",
        "aspectRatio",
        "backdropFilter",
        "backfaceVisibility",
        "background",
        "backgroundAttachment",
        "backgroundBlendMode",
        "backgroundClip",
        "backgroundImage",
        "backgroundOrigin",
        "backgroundPosition",
        "backgroundPositionX",
        "backgroundPositionY",
        "backgroundRepeat",
        "backgroundSize",
        "baselineShift",
        "baselineSource",
        "blockSize",
        "borderBlock",
        "borderBlockColor",
        "borderBlockEnd",
        "borderBlockEndColor",
        "borderBlockEndStyle",
        "borderBlockEndWidth",
        "borderBlockStart",
        "borderBlockStartColor",
        "borderBlockStartStyle",
        "borderBlockStartWidth",
        "borderBlockStyle",
        "borderBlockWidth",
        "borderBottom",
        "borderBottomColor",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
        "borderBottomStyle",
        "borderBottomWidth",
        "borderCollapse",
        "borderColor",
        "borderEndEndRadius",
        "borderEndStartRadius",
        "borderImage",
        "borderImageOutset",
        "borderImageRepeat",
        "borderImageSlice",
        "borderImageSource",
        "borderImageWidth",
        "borderInline",
        "borderInlineColor",
        "borderInlineEnd",
        "borderInlineEndColor",
        "borderInlineEndStyle",
        "borderInlineEndWidth",
        "borderInlineStart",
        "borderInlineStartColor",
        "borderInlineStartStyle",
        "borderInlineStartWidth",
        "borderInlineStyle",
        "borderInlineWidth",
        "borderLeft",
        "borderLeftColor",
        "borderLeftStyle",
        "borderLeftWidth",
        "borderRadius",
        "borderRight",
        "borderRightColor",
        "borderRightStyle",
        "borderRightWidth",
        "borderShape",
        "borderSpacing",
        "borderStartEndRadius",
        "borderStartStartRadius",
        "borderStyle",
        "borderTop",
        "borderTopColor",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderTopStyle",
        "borderTopWidth",
        "borderWidth",
        "bottom",
        "boxAlign",
        "boxDecorationBreak",
        "boxDirection",
        "boxFlex",
        "boxFlexGroup",
        "boxLines",
        "boxOrdinalGroup",
        "boxOrient",
        "boxPack",
        "boxShadow",
        "boxSizing",
        "breakAfter",
        "breakBefore",
        "breakInside",
        "captionSide",
        "caret",
        "caretAnimation",
        "caretColor",
        "caretShape",
        "clear",
        "clip",
        "clipPath",
        "clipRule",
        "color",
        "colorInterpolationFilters",
        "colorScheme",
        "columnCount",
        "columnFill",
        "columnGap",
        "columnHeight",
        "columnRule",
        "columnRuleColor",
        "columnRuleStyle",
        "columnRuleWidth",
        "columns",
        "columnSpan",
        "columnWidth",
        "columnWrap",
        "contain",
        "container",
        "containerName",
        "containerType",
        "containIntrinsicBlockSize",
        "containIntrinsicHeight",
        "containIntrinsicInlineSize",
        "containIntrinsicSize",
        "containIntrinsicWidth",
        "content",
        "contentVisibility",
        "cornerBlockEndShape",
        "cornerBlockStartShape",
        "cornerBottomLeftShape",
        "cornerBottomRightShape",
        "cornerBottomShape",
        "cornerEndEndShape",
        "cornerEndStartShape",
        "cornerInlineEndShape",
        "cornerInlineStartShape",
        "cornerLeftShape",
        "cornerRightShape",
        "cornerShape",
        "cornerStartEndShape",
        "cornerStartStartShape",
        "cornerTopLeftShape",
        "cornerTopRightShape",
        "cornerTopShape",
        "counterIncrement",
        "counterReset",
        "counterSet",
        "cursor",
        "cx",
        "cy",
        "d",
        "direction",
        "dominantBaseline",
        "dynamicRangeLimit",
        "emptyCells",
        "fieldSizing",
        "fill",
        "fillOpacity",
        "fillRule",
        "filter",
        "flex",
        "flexBasis",
        "flexDirection",
        "flexFlow",
        "flexGrow",
        "flexLineCount",
        "flexShrink",
        "flexWrap",
        "float",
        "floodColor",
        "floodOpacity",
        "font",
        "fontFamily",
        "fontFeatureSettings",
        "fontKerning",
        "fontLanguageOverride",
        "fontOpticalSizing",
        "fontPalette",
        "fontSize",
        "fontSizeAdjust",
        "fontSmooth",
        "fontStretch",
        "fontStyle",
        "fontSynthesis",
        "fontSynthesisPosition",
        "fontSynthesisSmallCaps",
        "fontSynthesisStyle",
        "fontSynthesisWeight",
        "fontVariant",
        "fontVariantAlternates",
        "fontVariantCaps",
        "fontVariantEastAsian",
        "fontVariantEmoji",
        "fontVariantLigatures",
        "fontVariantNumeric",
        "fontVariantPosition",
        "fontVariationSettings",
        "fontWeight",
        "fontWidth",
        "forcedColorAdjust",
        "frameSizing",
        "gap",
        "grid",
        "gridArea",
        "gridAutoColumns",
        "gridAutoFlow",
        "gridAutoRows",
        "gridColumn",
        "gridColumnEnd",
        "gridColumnGap",
        "gridColumnStart",
        "gridGap",
        "gridRow",
        "gridRowEnd",
        "gridRowGap",
        "gridRowStart",
        "gridTemplate",
        "gridTemplateAreas",
        "gridTemplateColumns",
        "gridTemplateRows",
        "hangingPunctuation",
        "height",
        "hyphenateCharacter",
        "hyphenateLimitChars",
        "hyphens",
        "imageOrientation",
        "imageRendering",
        "imageResolution",
        "imeMode",
        "initialLetter",
        "initialLetterAlign",
        "inlineSize",
        "inset",
        "insetBlock",
        "insetBlockEnd",
        "insetBlockStart",
        "insetInline",
        "insetInlineEnd",
        "insetInlineStart",
        "interactivity",
        "interestDelay",
        "interestDelayEnd",
        "interestDelayStart",
        "interpolateSize",
        "isolation",
        "justifyContent",
        "justifyItems",
        "justifySelf",
        "justifyTracks",
        "left",
        "letterSpacing",
        "lightingColor",
        "lineBreak",
        "lineClamp",
        "lineHeight",
        "lineHeightStep",
        "linkParameters",
        "listStyle",
        "listStyleImage",
        "listStylePosition",
        "listStyleType",
        "margin",
        "marginBlock",
        "marginBlockEnd",
        "marginBlockStart",
        "marginBottom",
        "marginInline",
        "marginInlineEnd",
        "marginInlineStart",
        "marginLeft",
        "marginRight",
        "marginTop",
        "marginTrim",
        "marker",
        "markerEnd",
        "markerMid",
        "markerStart",
        "mask",
        "maskBorder",
        "maskBorderMode",
        "maskBorderOutset",
        "maskBorderRepeat",
        "maskBorderSlice",
        "maskBorderSource",
        "maskBorderWidth",
        "maskClip",
        "maskComposite",
        "maskImage",
        "maskMode",
        "maskOrigin",
        "maskPosition",
        "maskRepeat",
        "maskSize",
        "maskType",
        "masonryAutoFlow",
        "mathDepth",
        "mathShift",
        "mathStyle",
        "maxBlockSize",
        "maxHeight",
        "maxInlineSize",
        "maxLines",
        "maxWidth",
        "minBlockSize",
        "minHeight",
        "minInlineSize",
        "minWidth",
        "mixBlendMode",
        "MozAppearance",
        "MozBinding",
        "MozBorderBottomColors",
        "MozBorderLeftColors",
        "MozBorderRightColors",
        "MozBorderTopColors",
        "MozContextProperties",
        "MozFloatEdge",
        "MozForceBrokenImageIcon",
        "MozOrient",
        "MozOutlineRadius",
        "MozOutlineRadiusBottomleft",
        "MozOutlineRadiusBottomright",
        "MozOutlineRadiusTopleft",
        "MozOutlineRadiusTopright",
        "MozStackSizing",
        "MozTextBlink",
        "MozUserFocus",
        "MozUserInput",
        "MozUserModify",
        "MozWindowDragging",
        "MozWindowShadow",
        "MsAccelerator",
        "MsBlockProgression",
        "MsContentZoomChaining",
        "MsContentZooming",
        "MsContentZoomLimit",
        "MsContentZoomLimitMax",
        "MsContentZoomLimitMin",
        "MsContentZoomSnap",
        "MsContentZoomSnapPoints",
        "MsContentZoomSnapType",
        "MsFilter",
        "MsFlowFrom",
        "MsFlowInto",
        "MsGridColumns",
        "MsGridRows",
        "MsHighContrastAdjust",
        "MsHyphenateLimitChars",
        "MsHyphenateLimitLines",
        "MsHyphenateLimitZone",
        "MsImeAlign",
        "MsOverflowStyle",
        "MsScrollbar3dlightColor",
        "MsScrollbarArrowColor",
        "MsScrollbarBaseColor",
        "MsScrollbarDarkshadowColor",
        "MsScrollbarFaceColor",
        "MsScrollbarHighlightColor",
        "MsScrollbarShadowColor",
        "MsScrollbarTrackColor",
        "MsScrollChaining",
        "MsScrollLimit",
        "MsScrollLimitXMax",
        "MsScrollLimitXMin",
        "MsScrollLimitYMax",
        "MsScrollLimitYMin",
        "MsScrollRails",
        "MsScrollSnapPointsX",
        "MsScrollSnapPointsY",
        "MsScrollSnapType",
        "MsScrollSnapX",
        "MsScrollSnapY",
        "MsScrollTranslation",
        "MsTextAutospace",
        "MsTouchSelect",
        "MsUserSelect",
        "MsWrapFlow",
        "MsWrapMargin",
        "MsWrapThrough",
        "objectFit",
        "objectPosition",
        "objectViewBox",
        "offset",
        "offsetAnchor",
        "offsetDistance",
        "offsetPath",
        "offsetPosition",
        "offsetRotate",
        "opacity",
        "order",
        "orphans",
        "outline",
        "outlineColor",
        "outlineOffset",
        "outlineStyle",
        "outlineWidth",
        "overflow",
        "overflowAnchor",
        "overflowBlock",
        "overflowClipBox",
        "overflowClipMargin",
        "overflowInline",
        "overflowWrap",
        "overflowX",
        "overflowY",
        "overlay",
        "overscrollBehavior",
        "overscrollBehaviorBlock",
        "overscrollBehaviorInline",
        "overscrollBehaviorX",
        "overscrollBehaviorY",
        "padding",
        "paddingBlock",
        "paddingBlockEnd",
        "paddingBlockStart",
        "paddingBottom",
        "paddingInline",
        "paddingInlineEnd",
        "paddingInlineStart",
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "page",
        "pageBreakAfter",
        "pageBreakBefore",
        "pageBreakInside",
        "paintOrder",
        "pathLength",
        "perspective",
        "perspectiveOrigin",
        "placeContent",
        "placeItems",
        "placeSelf",
        "pointerEvents",
        "position",
        "positionAnchor",
        "positionArea",
        "positionTry",
        "positionTryFallbacks",
        "positionTryOrder",
        "positionVisibility",
        "printColorAdjust",
        "quotes",
        "r",
        "readingFlow",
        "readingOrder",
        "resize",
        "right",
        "rotate",
        "rowGap",
        "rubyAlign",
        "rubyMerge",
        "rubyOverhang",
        "rubyPosition",
        "rx",
        "ry",
        "scale",
        "scrollbarColor",
        "scrollbarGutter",
        "scrollbarWidth",
        "scrollBehavior",
        "scrollInitialTarget",
        "scrollMargin",
        "scrollMarginBlock",
        "scrollMarginBlockEnd",
        "scrollMarginBlockStart",
        "scrollMarginBottom",
        "scrollMarginInline",
        "scrollMarginInlineEnd",
        "scrollMarginInlineStart",
        "scrollMarginLeft",
        "scrollMarginRight",
        "scrollMarginTop",
        "scrollMarkerGroup",
        "scrollPadding",
        "scrollPaddingBlock",
        "scrollPaddingBlockEnd",
        "scrollPaddingBlockStart",
        "scrollPaddingBottom",
        "scrollPaddingInline",
        "scrollPaddingInlineEnd",
        "scrollPaddingInlineStart",
        "scrollPaddingLeft",
        "scrollPaddingRight",
        "scrollPaddingTop",
        "scrollSnapAlign",
        "scrollSnapCoordinate",
        "scrollSnapDestination",
        "scrollSnapPointsX",
        "scrollSnapPointsY",
        "scrollSnapStop",
        "scrollSnapType",
        "scrollSnapTypeX",
        "scrollSnapTypeY",
        "scrollTargetGroup",
        "scrollTimeline",
        "scrollTimelineAxis",
        "scrollTimelineName",
        "shapeImageThreshold",
        "shapeMargin",
        "shapeOutside",
        "shapeRendering",
        "speakAs",
        "stopColor",
        "stopOpacity",
        "stroke",
        "strokeColor",
        "strokeDasharray",
        "strokeDashoffset",
        "strokeLinecap",
        "strokeLinejoin",
        "strokeMiterlimit",
        "strokeOpacity",
        "strokeWidth",
        "tableLayout",
        "tabSize",
        "textAlign",
        "textAlignLast",
        "textAnchor",
        "textAutospace",
        "textBox",
        "textBoxEdge",
        "textBoxTrim",
        "textCombineUpright",
        "textDecoration",
        "textDecorationColor",
        "textDecorationInset",
        "textDecorationLine",
        "textDecorationSkip",
        "textDecorationSkipInk",
        "textDecorationStyle",
        "textDecorationThickness",
        "textEmphasis",
        "textEmphasisColor",
        "textEmphasisPosition",
        "textEmphasisStyle",
        "textFit",
        "textIndent",
        "textJustify",
        "textOrientation",
        "textOverflow",
        "textRendering",
        "textShadow",
        "textSizeAdjust",
        "textSpacingTrim",
        "textTransform",
        "textUnderlineOffset",
        "textUnderlinePosition",
        "textWrap",
        "textWrapMode",
        "textWrapStyle",
        "timelineScope",
        "timelineTrigger",
        "timelineTriggerActivationRange",
        "timelineTriggerActivationRangeEnd",
        "timelineTriggerActivationRangeStart",
        "timelineTriggerActiveRange",
        "timelineTriggerActiveRangeEnd",
        "timelineTriggerActiveRangeStart",
        "timelineTriggerName",
        "timelineTriggerSource",
        "top",
        "touchAction",
        "transform",
        "transformBox",
        "transformOrigin",
        "transformStyle",
        "transition",
        "transitionBehavior",
        "transitionDelay",
        "transitionDuration",
        "transitionProperty",
        "transitionTimingFunction",
        "translate",
        "triggerScope",
        "unicodeBidi",
        "userSelect",
        "vectorEffect",
        "verticalAlign",
        "viewTimeline",
        "viewTimelineAxis",
        "viewTimelineInset",
        "viewTimelineName",
        "viewTransitionClass",
        "viewTransitionName",
        "viewTransitionScope",
        "visibility",
        "WebkitAppearance",
        "WebkitBorderAfter",
        "WebkitBorderAfterColor",
        "WebkitBorderAfterStyle",
        "WebkitBorderAfterWidth",
        "WebkitBorderBefore",
        "WebkitBorderBeforeColor",
        "WebkitBorderBeforeStyle",
        "WebkitBorderBeforeWidth",
        "WebkitBorderEnd",
        "WebkitBorderEndColor",
        "WebkitBorderEndStyle",
        "WebkitBorderEndWidth",
        "WebkitBorderStart",
        "WebkitBorderStartColor",
        "WebkitBorderStartStyle",
        "WebkitBorderStartWidth",
        "WebkitBoxReflect",
        "WebkitLineClamp",
        "WebkitMask",
        "WebkitMaskAttachment",
        "WebkitMaskClip",
        "WebkitMaskComposite",
        "WebkitMaskImage",
        "WebkitMaskOrigin",
        "WebkitMaskPosition",
        "WebkitMaskPositionX",
        "WebkitMaskPositionY",
        "WebkitMaskRepeat",
        "WebkitMaskRepeatX",
        "WebkitMaskRepeatY",
        "WebkitMaskSize",
        "WebkitOverflowScrolling",
        "WebkitTapHighlightColor",
        "WebkitTextFillColor",
        "WebkitTextStroke",
        "WebkitTextStrokeColor",
        "WebkitTextStrokeWidth",
        "WebkitTouchCallout",
        "WebkitUserModify",
        "WebkitUserSelect",
        "whiteSpace",
        "whiteSpaceCollapse",
        "widows",
        "width",
        "willChange",
        "wordBreak",
        "wordSpacing",
        "wordWrap",
        "writingMode",
        "x",
        "y",
        "zIndex",
        "zoom",
      ]
    `)
      expect(complete('alignItems', 'center', '')).toMatchInlineSnapshot(`
      [
        "baseline",
        "center",
        "end",
        "first baseline",
        "flex-end",
        "flex-start",
        "last baseline",
        "normal",
        "safe center",
        "safe end",
        "safe flex-end",
        "safe flex-start",
        "safe start",
        "start",
        "stretch",
        "unsafe center",
        "unsafe end",
        "unsafe flex-end",
        "unsafe flex-start",
        "unsafe start",
        "anchor-center",
        "safe self-end",
        "safe self-start",
        "self-end",
        "self-start",
        "unsafe self-end",
        "unsafe self-start",
        "inherit",
        "initial",
        "revert",
        "revert-layer",
        "unset",
      ]
    `)
      expect(complete('alignItems', 'center', 'ce')).toMatchInlineSnapshot(`
      [
        "baseline",
        "center",
        "end",
        "first baseline",
        "flex-end",
        "flex-start",
        "last baseline",
        "normal",
        "safe center",
        "safe end",
        "safe flex-end",
        "safe flex-start",
        "safe start",
        "start",
        "stretch",
        "unsafe center",
        "unsafe end",
        "unsafe flex-end",
        "unsafe flex-start",
        "unsafe start",
        "anchor-center",
        "safe self-end",
        "safe self-start",
        "self-end",
        "self-start",
        "unsafe self-end",
        "unsafe self-start",
        "inherit",
        "initial",
        "revert",
        "revert-layer",
        "unset",
      ]
    `)
      expect(complete('backgroundColor', 'light-dark(#fff, #171717)', ''))
        .toMatchInlineSnapshot(`
      [
        "inherit",
        "initial",
        "revert",
        "revert-layer",
        "unset",
        "aliceblue",
        "antiquewhite",
        "aqua",
        "aquamarine",
        "azure",
        "beige",
        "bisque",
        "black",
        "blanchedalmond",
        "blue",
        "blueviolet",
        "brown",
        "burlywood",
        "cadetblue",
        "chartreuse",
        "chocolate",
        "coral",
        "cornflowerblue",
        "cornsilk",
        "crimson",
        "cyan",
        "darkblue",
        "darkcyan",
        "darkgoldenrod",
        "darkgray",
        "darkgreen",
        "darkgrey",
        "darkkhaki",
        "darkmagenta",
        "darkolivegreen",
        "darkorange",
        "darkorchid",
        "darkred",
        "darksalmon",
        "darkseagreen",
        "darkslateblue",
        "darkslategray",
        "darkslategrey",
        "darkturquoise",
        "darkviolet",
        "deeppink",
        "deepskyblue",
        "dimgray",
        "dimgrey",
        "dodgerblue",
        "firebrick",
        "floralwhite",
        "forestgreen",
        "fuchsia",
        "gainsboro",
        "ghostwhite",
        "gold",
        "goldenrod",
        "gray",
        "green",
        "greenyellow",
        "grey",
        "honeydew",
        "hotpink",
        "indianred",
        "indigo",
        "ivory",
        "khaki",
        "lavender",
        "lavenderblush",
        "lawngreen",
        "lemonchiffon",
        "lightblue",
        "lightcoral",
        "lightcyan",
        "lightgoldenrodyellow",
        "lightgray",
        "lightgreen",
        "lightgrey",
        "lightpink",
        "lightsalmon",
        "lightseagreen",
        "lightskyblue",
        "lightslategray",
        "lightslategrey",
        "lightsteelblue",
        "lightyellow",
        "lime",
        "limegreen",
        "linen",
        "magenta",
        "maroon",
        "mediumaquamarine",
        "mediumblue",
        "mediumorchid",
        "mediumpurple",
        "mediumseagreen",
        "mediumslateblue",
        "mediumspringgreen",
        "mediumturquoise",
        "mediumvioletred",
        "midnightblue",
        "mintcream",
        "mistyrose",
        "moccasin",
        "navajowhite",
        "navy",
        "oldlace",
        "olive",
        "olivedrab",
        "orange",
        "orangered",
        "orchid",
        "palegoldenrod",
        "palegreen",
        "paleturquoise",
        "palevioletred",
        "papayawhip",
        "peachpuff",
        "peru",
        "pink",
        "plum",
        "powderblue",
        "purple",
        "rebeccapurple",
        "red",
        "rosybrown",
        "royalblue",
        "saddlebrown",
        "salmon",
        "sandybrown",
        "seagreen",
        "seashell",
        "sienna",
        "silver",
        "skyblue",
        "slateblue",
        "slategray",
        "slategrey",
        "snow",
        "springgreen",
        "steelblue",
        "tan",
        "teal",
        "thistle",
        "tomato",
        "turquoise",
        "violet",
        "wheat",
        "white",
        "whitesmoke",
        "yellow",
        "yellowgreen",
        "ActiveBorder",
        "ActiveCaption",
        "AppWorkspace",
        "Background",
        "ButtonHighlight",
        "ButtonShadow",
        "CaptionText",
        "InactiveBorder",
        "InactiveCaption",
        "InactiveCaptionText",
        "InfoBackground",
        "InfoText",
        "Menu",
        "MenuText",
        "Scrollbar",
        "ThreeDDarkShadow",
        "ThreeDFace",
        "ThreeDHighlight",
        "ThreeDLightShadow",
        "ThreeDShadow",
        "Window",
        "WindowFrame",
        "WindowText",
        "AccentColor",
        "AccentColorText",
        "ActiveText",
        "ButtonBorder",
        "ButtonFace",
        "ButtonText",
        "Canvas",
        "CanvasText",
        "Field",
        "FieldText",
        "GrayText",
        "Highlight",
        "HighlightText",
        "LinkText",
        "Mark",
        "MarkText",
        "SelectedItem",
        "SelectedItemText",
        "VisitedText",
        "currentColor",
        "currentcolor",
        "transparent",
      ]
    `)
      expect(complete('display', 'flex', '')).toMatchInlineSnapshot(`
      [
        "flex",
        "grid",
        "inherit",
        "initial",
        "revert",
        "revert-layer",
        "unset",
        "none",
        "block",
        "block flex",
        "block flow",
        "block flow list-item",
        "block flow-root",
        "block flow-root list-item",
        "block grid",
        "block list-item",
        "block list-item flow",
        "block list-item flow-root",
        "block ruby",
        "block table",
        "contents",
        "flex block",
        "flex inline",
        "flex run-in",
        "flow",
        "flow block",
        "flow block list-item",
        "flow inline",
        "flow inline list-item",
        "flow list-item",
        "flow list-item block",
        "flow list-item inline",
        "flow list-item run-in",
        "flow run-in",
        "flow run-in list-item",
        "flow-root",
        "flow-root block",
        "flow-root block list-item",
        "flow-root inline",
        "flow-root inline list-item",
        "flow-root list-item",
        "flow-root list-item block",
        "flow-root list-item inline",
        "flow-root list-item run-in",
        "flow-root run-in",
        "flow-root run-in list-item",
        "grid block",
        "grid inline",
        "grid run-in",
        "inline",
        "inline flex",
        "inline flow",
        "inline flow list-item",
        "inline flow-root",
        "inline flow-root list-item",
        "inline grid",
        "inline list-item",
        "inline list-item flow",
        "inline list-item flow-root",
        "inline ruby",
        "inline table",
        "inline-block",
        "inline-flex",
        "inline-grid",
        "inline-list-item",
        "inline-table",
        "list-item",
        "list-item block",
        "list-item block flow",
        "list-item block flow-root",
        "list-item flow",
        "list-item flow block",
        "list-item flow inline",
        "list-item flow run-in",
        "list-item flow-root",
        "list-item flow-root block",
        "list-item flow-root inline",
        "list-item flow-root run-in",
        "list-item inline",
        "list-item inline flow",
        "list-item inline flow-root",
        "list-item run-in",
        "list-item run-in flow",
        "list-item run-in flow-root",
        "ruby",
        "ruby block",
        "ruby inline",
        "ruby run-in",
        "ruby-base",
        "ruby-base-container",
        "ruby-text",
        "ruby-text-container",
        "run-in",
        "run-in flex",
        "run-in flow",
        "run-in flow list-item",
        "run-in flow-root",
        "run-in flow-root list-item",
        "run-in grid",
        "run-in list-item",
        "run-in list-item flow",
        "run-in list-item flow-root",
        "run-in ruby",
        "run-in table",
        "table",
        "table block",
        "table inline",
        "table run-in",
        "table-caption",
        "table-cell",
        "table-column",
        "table-column-group",
        "table-footer-group",
        "table-header-group",
        "table-row",
        "table-row-group",
      ]
    `)
      expect(diagnose("display: 'flex'", "display: 'invalid-display'"))
        .toMatchInlineSnapshot(`
          [
            {
              "code": 2322,
              "message": "Type '"invalid-display"' is not assignable to type '("invalid-display" & Reference<"*">) | ("invalid-display" & readonly [Atom<Value<{ readonly kind: "enum"; readonly values: readonly ["block", "block flex", "block flow", "block flow list-item", ... 106 more ..., "table-row-group"]; }> | \`\${string} !custom\` | Reference<...>>, ...Atom<...>[]])'.",
              "span": "display",
            },
          ]
        `)
      expect(diagnose('opacity: 0.5', "opacity: 'invalid-opacity'"))
        .toMatchInlineSnapshot(`
          [
            {
              "code": 2322,
              "message": "Type '"invalid-opacity"' is not assignable to type '"invalid-opacity" & Fallbacks<Atom<\`\${string} !custom\` | Reference<"*"> | Reference<"number"> | Reference<"percentage"> | Value<{ readonly kind: "number"; readonly min: number; readonly max: number; readonly percentage: true; }>>>'.",
              "span": "opacity",
            },
          ]
        `)
      expect(diagnose("alignItems: 'center'", "unknownProperty: 'center'"))
        .toMatchInlineSnapshot(`
      [
        {
          "code": 2322,
          "message": "Type 'string' is not assignable to type 'never'.",
          "span": "unknownProperty",
        },
      ]
    `)
    } finally {
      service.dispose()
    }
  }, 60_000)

  test('rejects target accessors without invoking caller code', () => {
    let calls = 0
    const targets = {
      get native(): { opacity: number } {
        calls++
        throw new Error('getter ran')
      },
    }

    expect(() => style({ targets })).toThrow(Style.InvalidError)
    expect(calls).toMatchInlineSnapshot('0')
  })

  test('omits undefined target containers and branches', () => {
    const bound = Config.create({})

    expect(style({ opacity: 0.5, targets: undefined })()).toEqual(
      style({ opacity: 0.5 })(),
    )
    expect(bound.style({ targets: { web: undefined } })()).toEqual(
      style({ targets: {} })(),
    )
    expect(() => style({ targets: null } as never)).toThrow(Style.InvalidError)
    expect(
      Style.define({ card: { targets: undefined } }).styles[0]?.targets,
    ).toMatchInlineSnapshot('undefined')
  })

  test.each([{ web: { opacity: 0.6 } }, { native: { opacity: 0.6 } }] as const)(
    'keeps target-only CSS build identities aligned with runtime',
    (targets) => {
      const source = `import {style} from 'zyzz';export const card=style({targets:${JSON.stringify(targets)}});`
      const output = Graph.compile({
        compiler: false,
        modules: { 'card.ts': source },
      })

      expect(Object.values(output.modules['card.ts']!.classes)).toContain(
        style({ targets })().className,
      )
    },
  )

  test('public root bundles for browsers without the source parser', async () => {
    const result = await Esbuild.build({
      bundle: true,
      conditions: ['src'],
      metafile: true,
      platform: 'browser',
      stdin: {
        contents: "export { style, Style } from 'zyzz'",
        resolveDir: process.cwd(),
      },
      write: false,
    })

    expect({
      browserBundle: result.outputFiles.length,
      parserIncluded: Object.keys(result.metafile.inputs).some(
        (path) =>
          path.includes('@babel') ||
          path.includes('oxc-parser') ||
          path.includes('oxc-walker') ||
          path.includes('/compiler/'),
      ),
    }).toMatchInlineSnapshot(`
    {
      "browserBundle": 1,
      "parserIncluded": false,
    }
  `)
  })

  test('literal authoring extracts and returns runtime props', () => {
    const result = Source.extract({
      moduleId: 'example/style.ts',
      source: "import { style } from 'zyzz'; style({ padding: 0 });",
    })

    expect(Css.compile({ styles: result.styles }).css).toMatchInlineSnapshot(
      `".z-p-0{padding:0;}"`,
    )
    expect(style({ padding: 0 })()).toMatchInlineSnapshot(`
      {
        "className": "z-content-1b24kzfsiva6x",
      }
    `)
  })
})

describe('selectors', () => {
  const source = `import {style} from 'zyzz';
export namespace styles {
  export const card = style({ padding: '16px' })
  export const empty = style()
  export const label = style({color: 'black',selectors:{[\`\${card}:hover &\`]:{ color: 'blue' },[\`\${card} > &:nth-child(even)\`]:{ opacity: 0.5 },[\`\${empty} + &\`]:{ fontWeight: 700 }}})
}
export const outside = style({selectors:{[\`\${styles.card} > &\`]:{ margin: 0 }}})`

  describe('selectors', () => {
    test('resolves standalone selector maps and spreads in static and dynamic definitions', () => {
      const result = Graph.compile({
        modules: {
          'shared.ts': `
      import {style} from 'zyzz';
      const parent=style();
      const selectors={'&:hover':{color:'red'},[\`\${parent} > &\`]:{color:'blue'}};
      export const direct=style({selectors});
      export const spread=style({selectors:{...selectors,'&:focus':{color:'green'}}});
      export const dynamic=style((input:{opacity:number})=>({selectors,opacity:input.opacity}));
      const unrelated={selectors:{invalid:{arbitrary:true}}};
    `,
        },
      })

      expect(result.modules['shared.ts']!.css).toMatchInlineSnapshot(`
        ".z-hover-text-red-0Jq0sU-0{&:hover{color:red;}}
        .z-text-1D81Zs-1{.z-style-1stl7if1lvmpx3-54 > &{color:blue;}}
        .z-hover-text-red-7cRIyE-0{&:hover{color:red;}}
        .z-text-DOHDSJ-1{.z-style-1stl7if1lvmpx3-54 > &{color:blue;}}
        .z-focus-text-green-7cRIyE-2{&:focus{color:green;}}
        .z-hover-text-red-T0s3jE-0{&:hover{color:red;}}
        .z-text-wk-1Dw-1{.z-style-1stl7if1lvmpx3-54 > &{color:blue;}}
        .z-opacity-juXi1t-2{opacity:var(--z-d1stl7if1lvmpx3-305-6f-70-61-63-69-74-79);}"
      `)
    })

    test('compiles empty theme and configured HTML definitions', () => {
      const result = Graph.compile({
        modules: {
          'empty.ts':
            "import { Config, style, Vars } from 'zyzz';\nconst theme = Vars.define({}); const themeConfig=Config.create({vars:theme});\nconst config = Config.create({ output: 'html', vars: {} });\nexport const themed = themeConfig.style();\nexport const configured = config.style();\nexport const bare = style()();\nexport const child = config.style({selectors:{[`${themed} > &, ${configured} + &`]:{ color: 'red' }}});",
        },
      })

      expect(result.modules['empty.ts']!.code).toMatchInlineSnapshot(`
        "
        import { CompositionHtml as __zyzzCompositionHtml, Props as __zyzzProps } from 'zyzz/runtime';

        const theme = ({} as import('zyzz').Vars.Definition<{}>); const themeConfig=({} as import('zyzz').Config.VariableConfig<{readonly "vars":{}}>);
        const config = ({} as import('zyzz').Config.VariableConfig<{readonly "output":"html";readonly "vars":{}}>);
        export const themed = __zyzzProps.create({className:"z-style-urrzb11meswl3-204"});
        export const configured = (__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-style-urrzb11meswl3-251"})) as import('zyzz').style.ReturnType<'html'>);
        export const bare = ({className:""});
        export const child = (__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-text-dMTSE6-0 z-style-urrzb11meswl3-319"})) as import('zyzz').style.ReturnType<'html'>);"
      `)
      expect(result.modules['empty.ts']!.css).toMatchInlineSnapshot(
        `".z-text-dMTSE6-0{.z-style-urrzb11meswl3-204 > &, .z-style-urrzb11meswl3-251 + &{color:red;}}"`,
      )
    })

    test('compiles namespace definitions and scoped selectors', () => {
      const result = Graph.compile({ modules: { 'app.ts': source } })
      expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z-p-16px-NXxdb9-0{padding:16px;}
        .z-text-black-mlKEVF-0{color:black;}
        .z-text-bzJ65j-1{.z-style-1e8a67z1uaws1j-76:hover &{color:blue;}}
        .z-opacity-jO25_5-2{.z-style-1e8a67z1uaws1j-76 > &:nth-child(even){opacity:0.5;}}
        .z-font-weight-lFhQWE-3{.z-style-1e8a67z1uaws1j-126 + &{font-weight:700;}}
        .z-m-kMGq6d-0{.z-style-1e8a67z1uaws1j-76 > &{margin:0;}}"
      `)
      expect(result.modules['app.ts']!.code).toMatchInlineSnapshot(`
        "
        import { Props as __zyzzProps } from 'zyzz/runtime';

        export namespace styles {
          export const card = __zyzzProps.create({className:"z-p-16px-NXxdb9-0 z-style-1e8a67z1uaws1j-76"})
          export const empty = __zyzzProps.create({className:"z-style-1e8a67z1uaws1j-126"})
          export const label = __zyzzProps.create({className:"z-text-black-mlKEVF-0 z-text-bzJ65j-1 z-opacity-jO25_5-2 z-font-weight-lFhQWE-3 z-style-1e8a67z1uaws1j-157"})
        }
        export const outside = __zyzzProps.create({className:"z-m-kMGq6d-0 z-style-1e8a67z1uaws1j-342"})"
      `)
    })

    test('resolves aliases and named re-exports across source and packed modules', () => {
      const publisher = Graph.compile({
        modules: {
          'library.ts': `import { style } from 'zyzz'; export const card = style(); export namespace styles { export const button = style({color:'red'}) }`,
          'barrel.ts': `import { card, styles } from './library.js'; export { card as panel, styles }`,
        },
      })
      const app = `import {style} from 'zyzz'; import { panel, styles } from './barrel.js'; const alias = panel; export const label = style({ selectors: {[\`\${alias} > &, \${styles.button} + &\`]: {color:'blue'}} })`
      const result = Graph.compile({
        modules: { 'app.ts': app },
        contracts: publisher.contracts,
        imports: { 'app.ts': { zyzz: null, './barrel.js': 'barrel.ts' } },
      })
      expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
        `".z-text-cGq-9x-0{.z-style-ggnaaj17b3mnh-50 > &, .z-style-ggnaaj17b3mnh-107 + &{color:blue;}}"`,
      )
      expect(
        JSON.parse(publisher.contracts['barrel.ts']!).version,
      ).toMatchInlineSnapshot(`21`)
    })

    test('rejects unresolved, called, forward, and unscoped references', () => {
      expect(() =>
        Source.extract({
          moduleId: 'invalid.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`\${missing} &\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:50: Selector interpolations require previously declared style definitions.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'called.ts',
          source: `import {style} from 'zyzz'; const card=style({}); style({selectors:{[\`\${card()} &\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: called.ts:72: Selector interpolations require style definitions without calling them.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'forward.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`\${card} &\`]:{color:'red'}}}); const card=style({})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: forward.ts:50: Selector interpolations require previously declared style definitions.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'scope.ts',
          source: `import {style} from 'zyzz'; const card=style({}); style({selectors:{[\`\${card}:hover\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: scope.ts:68: Selectors require an explicit & target.]`,
      )
    })

    test('keeps lexical aliases and deduplicated definitions distinct', () => {
      const result = Graph.compile({
        modules: {
          'scoped.ts': `import {style} from 'zyzz';
const card=style({color:'red'}); const alias=card;
const other=style({color:'red'});
function nested(){ const card=other; return style({selectors:{[\`\${alias}:hover &\`]:{color:'blue'}}}) }
export {card,other,nested};`,
        },
      })
      expect(result.modules['scoped.ts']!.code).toMatchInlineSnapshot(`
        "
        import { Props as __zyzzProps } from 'zyzz/runtime';

        const card=__zyzzProps.create({className:"z-text-red-JVDBqH-0 z-style-1kmi93w1julwr4-39"}); const alias=card;
        const other=__zyzzProps.create({className:"z-text-red-8fFQWb-0 z-style-1kmi93w1julwr4-91"});
        function nested(){ const card=other; return __zyzzProps.create({className:"z-text-p1JECT-0"}) }
        export {card,other,nested};"
      `)
      expect(result.modules['scoped.ts']!.css).toMatchInlineSnapshot(`
        ".z-text-red-JVDBqH-0{color:red;}
        .z-text-red-8fFQWb-0{color:red;}
        .z-text-p1JECT-0{.z-style-1kmi93w1julwr4-39:hover &{color:blue;}}"
      `)
    })

    test('binds dynamic ancestor conditions and rejects descendant slot targets', () => {
      const result = Graph.compile({
        modules: {
          'dynamic.ts': `import {style} from 'zyzz';
const card=style({}); export const label=style((values:{opacity:number})=>({selectors:{[\`\${card}:hover &\`]:{opacity:values.opacity}}}));`,
        },
      })
      expect(result.modules['dynamic.ts']!.code).toMatchInlineSnapshot(`
        "
        import { Props as __zyzzProps } from 'zyzz/runtime';

        const card=__zyzzProps.create({className:"z-style-1h5dayl7tfv4v-39"}); export const label=(((input:Parameters<import('zyzz').style.Dynamic<{opacity:number}>>[0])=>{const v0=input["opacity"] as string | number;const external=input.className;const style=input.style;return {className:external?"z-opacity-rAgY3A-0 z-style-1h5dayl7tfv4v-69"+" "+external:"z-opacity-rAgY3A-0 z-style-1h5dayl7tfv4v-69",style:{...input.vars,...style,"--z-d1h5dayl7tfv4v-69-6f-70-61-63-69-74-79":v0===''?' ':v0}}}) as import('zyzz').style.Dynamic<{opacity:number}>);"
      `)
      expect(() =>
        Source.extract({
          moduleId: 'descendant.ts',
          source: `import {style} from 'zyzz'; style((values:{opacity:number})=>({selectors:{[\`& > span\`]:{opacity:values.opacity}}}))`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Source.ExtractError: descendant.ts:96: Dynamic values require conditions that select the styled element.
        descendant.ts:96: Expected a literal string or number; expressions are not evaluated.]
      `)
    })

    test('rejects unscoped lists, malformed selectors, and missing ampersands', () => {
      expect(() =>
        Source.extract({
          moduleId: 'list.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`&:hover, body\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: list.ts:46: Selector lists require explicit & selectors.]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'syntax.ts',
          source: `import {style} from 'zyzz'; style({selectors:{[\`& > > span\`]:{color:'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: syntax.ts:46: Invalid dangling combinator in selector]`,
      )
      expect(() =>
        Source.extract({
          moduleId: 'standalone.ts',
          source: `import {style} from 'zyzz'; style({selectors: {'body': {color: 'red'}}})`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: standalone.ts:47: Selectors require an explicit & target.]`,
      )
    })

    test('reuses static selector declarations without interpreting unrelated application data', () => {
      const output = Graph.compile({
        modules: {
          'static.ts': `import {style} from 'zyzz';
const application={selectors:{name:'unrelated'}};
namespace styles {
  export const parent=style();
  const shared={selectors:{[\`\${parent}:hover &\`]:{color:'red'}}};
  export const child=style(shared);
}`,
        },
      })
      expect(output.modules['static.ts']!.css).toMatchInlineSnapshot(
        `".z-text-rR8AAE-0{.z-style-15wl7di1emu9we-119:hover &{color:red;}}"`,
      )
    })

    test('renders hover, nth-child, and empty style relationships', async () => {
      const result = Graph.compile({ modules: { 'app.ts': source } })
      const built = await Esbuild.transform(result.modules['app.ts']!.code, {
        format: 'esm',
        loader: 'ts',
      })
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      })
      try {
        const page = await browser.newPage()
        // Bundle the actual public runtime alongside the transformed consumer module.
        const bundled = await Esbuild.build({
          stdin: {
            contents: built.code,
            resolveDir: process.cwd(),
            sourcefile: 'app.js',
          },
          alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
          bundle: true,
          format: 'iife',
          globalName: 'App',
          write: false,
        })
        await page.setContent(
          `<style>${result.modules['app.ts']!.css}</style><div id="root"></div>`,
        )
        await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
        await page.evaluate(`{
        const {styles} = App;
        document.querySelector('#root').innerHTML = '<div id="card" class="'+styles.card().className+'"><span class="'+styles.empty().className+'"></span><span id="label" class="'+styles.label().className+'">Label</span></div>';
      }`)
        expect(
          await page
            .locator('#label')
            .evaluate((node) => getComputedStyle(node).opacity),
        ).toMatchInlineSnapshot('"0.5"')
        expect(
          await page
            .locator('#label')
            .evaluate((node) => getComputedStyle(node).fontWeight),
        ).toMatchInlineSnapshot('"700"')
        await page.locator('#card').hover()
        expect(
          await page
            .locator('#label')
            .evaluate((node) => getComputedStyle(node).color),
        ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
      } finally {
        await browser.close()
      }
    })
  })
})
