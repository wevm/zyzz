//! Lowers native media rules and conditional tokens to bounded static alternatives, mirroring
//! `NativeMedia.prepare`.
//!
//! Media rule conditions and the media-keyed branches of variable values become at most eight
//! distinct window queries. Each selection of those queries rewrites styles and variable sets to
//! the branches it activates. Selection allocates fresh tokens, expressions, and records, as the
//! TypeScript selection creates fresh objects, so identity-based scheme sharing behaves the same.
//! Rust values cannot form the object cycles the TypeScript selection guards against.

use std::sync::Arc;

use rustc_hash::{FxHashMap, FxHashSet};
use zyzz_css_syntax::{Ast, Context, Node, NodeId, ParseOptions};

use crate::error::{Error, Result};
use crate::internal::theme::Definition;
use crate::internal::token::{Expression, Map, Metadata, Part, Reference, Value as TokenValue};
use crate::js::{self, Record};
use crate::react_native::internal::scalar::{self, Value as Scalar};
use crate::runtime::internal::native_media::{Operand, Operator, Query};
use crate::style::{self, NamedStyle, Rule};

/// Most distinct queries one definition may select between.
const LIMIT: usize = 8;

/// Most syntax nodes one condition may contain.
const NODES: usize = 128;

/// Distinct window queries and the condition names that select them.
#[derive(Clone, Debug)]
pub struct Media<'a> {
    catalog: Option<&'a Record<Arc<Definition>>>,
    names: FxHashMap<Arc<str>, usize>,
    /// Distinct queries in selection order.
    pub queries: Vec<Query>,
}

impl<'a> Media<'a> {
    /// Every selection key: one `0` or `1` per query, counting up in binary.
    pub fn selections(&self) -> Vec<String> {
        let width = self.queries.len();

        (0..1_usize << width)
            .map(|index| format!("{index:0width$b}"))
            .collect()
    }

    /// Selects the branches one selection key activates.
    pub fn select<'s>(&'s self, selection: &'s str) -> Selection<'s, 'a> {
        Selection {
            media: self,
            selection: selection.as_bytes(),
        }
    }
}

/// The styles and variable sets of one selection.
#[derive(Clone, Copy, Debug)]
pub struct Selection<'s, 'a> {
    media: &'s Media<'a>,
    selection: &'s [u8],
}

impl Selection<'_, '_> {
    /// Rewrites a style: selected media rules lose their condition, unselected ones are dropped,
    /// and conditional values take their selected branch.
    pub fn style(&self, entry: &NamedStyle) -> NamedStyle {
        let declarations = entry
            .declarations
            .iter()
            .map(|declaration| style::Declaration {
                important: declaration.important,
                property: Arc::clone(&declaration.property),
                value: self.value(&declaration.value),
            })
            .collect();
        let rules = entry.rules.as_ref().map(|rules| {
            rules
                .iter()
                .filter_map(|rule| {
                    let index = rule
                        .condition
                        .as_ref()
                        .and_then(|condition| self.media.names.get(condition));

                    if index.is_some_and(|index| !self.active(*index)) {
                        return None;
                    }

                    Some(Rule {
                        condition: if index.is_some() {
                            None
                        } else {
                            rule.condition.clone()
                        },
                        style: Arc::new(self.style(&rule.style)),
                    })
                })
                .collect()
        });

        NamedStyle {
            composition: entry.composition,
            css_output: entry.css_output,
            declarations,
            name: Arc::clone(&entry.name),
            rules,
            targets: entry.targets.clone(),
        }
    }

    /// Rewrites every set of the catalog, when one was supplied.
    pub fn vars(&self) -> Option<Record<Arc<Definition>>> {
        self.media.catalog.map(|catalog| {
            catalog
                .iter()
                .map(|(name, theme)| {
                    let values: Map<TokenValue> = theme
                        .metadata
                        .values
                        .iter()
                        .map(|(path, entry)| (Arc::clone(path), self.token_value(entry)))
                        .collect();
                    let definition = Definition {
                        metadata: Metadata {
                            values: Arc::new(values),
                            ..theme.metadata.clone()
                        },
                        ..(**theme).clone()
                    };

                    (Arc::clone(name), Arc::new(definition))
                })
                .collect()
        })
    }

    fn active(&self, index: usize) -> bool {
        self.selection.get(index) == Some(&b'1')
    }

    fn value(&self, value: &style::Value) -> style::Value {
        match value {
            style::Value::Token(reference) => style::Value::Token(self.reference(reference)),
            style::Value::Expression(expression) => {
                style::Value::Expression(self.expression(expression))
            }
            other => other.clone(),
        }
    }

    fn reference(&self, reference: &Reference) -> Arc<Reference> {
        Arc::new(Reference {
            value: self.token_value(&reference.value),
            ..reference.clone()
        })
    }

    fn expression(&self, expression: &Expression) -> Arc<Expression> {
        Arc::new(Expression {
            group: expression.group.clone(),
            parts: expression
                .parts
                .iter()
                .map(|part| match part {
                    Part::Reference(reference) => Part::Reference(self.reference(reference)),
                    other => other.clone(),
                })
                .collect(),
        })
    }

    fn token_value(&self, value: &TokenValue) -> TokenValue {
        match value {
            TokenValue::Reference(reference) => TokenValue::Reference(self.reference(reference)),
            TokenValue::Composition(expression) => {
                TokenValue::Composition(self.expression(expression))
            }
            TokenValue::Record(entries) => {
                let names = &self.media.names;

                if let Some(default) = value.field("default") {
                    // A branch the compiler cannot select keeps the record for its diagnostic.
                    if entries
                        .iter()
                        .any(|(name, _)| &**name != "default" && !names.contains_key(name))
                    {
                        return TokenValue::Record(
                            entries
                                .iter()
                                .filter(|(name, _)| {
                                    &**name == "default" || !names.contains_key(name)
                                })
                                .map(|(name, branch)| (Arc::clone(name), self.token_value(branch)))
                                .collect(),
                        );
                    }

                    let mut selected = default;

                    for (name, branch) in entries.iter() {
                        if &**name != "default"
                            && names.get(name).is_some_and(|index| self.active(*index))
                        {
                            selected = branch;
                        }
                    }

                    return self.token_value(selected);
                }

                if value.field("light").is_some() && value.field("dark").is_some() {
                    return TokenValue::Record(
                        entries
                            .iter()
                            .map(|(name, branch)| {
                                let branch = if matches!(&**name, "dark" | "light") {
                                    self.token_value(branch)
                                } else {
                                    branch.clone()
                                };

                                (Arc::clone(name), branch)
                            })
                            .collect(),
                    );
                }

                value.clone()
            }
            other => other.clone(),
        }
    }
}

/// A preparation failure. Unsupported conditions on variable branches stay deferred to the read.
enum Failure {
    Error(Error),
    Unsupported(String),
}

impl Failure {
    fn unsupported(message: &str) -> Self {
        Self::Unsupported(message.to_owned())
    }

    fn into_error(self) -> Error {
        match self {
            Self::Error(error) => error,
            Self::Unsupported(message) => Error::Message(message),
        }
    }
}

/// Collects the media conditions of styles, or of every catalog value without styles.
///
/// Returns `None` when nothing is media-conditioned.
///
/// # Errors
///
/// Returns an error for an unsupported media rule condition, a ninth distinct query, a condition
/// over 128 syntax nodes, or malformed condition syntax. Unsupported conditions on variable
/// branches are left for the variable read to report.
pub fn prepare<'a>(
    styles: Option<&[Arc<NamedStyle>]>,
    vars: Option<&'a Record<Arc<Definition>>>,
    options: &scalar::Options,
) -> Result<Option<Media<'a>>> {
    let mut collector = Collector {
        catalog: vars,
        expressions: FxHashMap::default(),
        names: FxHashMap::default(),
        options,
        queries: Vec::new(),
        visited: FxHashSet::default(),
    };

    match styles {
        Some(styles) => {
            for style in styles {
                collector.visit(style)?;
            }
        }
        None => {
            for theme in vars.into_iter().flat_map(Record::values) {
                for value in theme.metadata.values.values() {
                    collector.token_value(value)?;
                }
            }
        }
    }

    if collector.queries.is_empty() {
        return Ok(None);
    }

    Ok(Some(Media {
        catalog: vars,
        names: collector.names,
        queries: collector.queries,
    }))
}

struct Collector<'a, 'o> {
    catalog: Option<&'a Record<Arc<Definition>>>,
    expressions: FxHashMap<String, usize>,
    names: FxHashMap<Arc<str>, usize>,
    options: &'o scalar::Options,
    queries: Vec<Query>,
    /// Addresses of visited references, expressions, and records, as the TypeScript set of
    /// visited objects.
    visited: FxHashSet<usize>,
}

impl Collector<'_, '_> {
    fn add(&mut self, name: &Arc<str>) -> std::result::Result<(), Failure> {
        if self.names.contains_key(name) {
            return Ok(());
        }

        let query = parse(name, self.options)?;
        let mut expression = String::new();

        query.write_json(&mut expression);

        let index = if let Some(index) = self.expressions.get(&expression) {
            *index
        } else {
            let index = self.queries.len();

            if index == LIMIT {
                return Err(Failure::Error(Error::message(
                    "Native media supports at most eight distinct conditions per definition.",
                )));
            }

            self.queries.push(query);
            self.expressions.insert(expression, index);
            index
        };

        self.names.insert(Arc::clone(name), index);
        Ok(())
    }

    fn visit(&mut self, style: &NamedStyle) -> Result<()> {
        for declaration in &style.declarations {
            match &declaration.value {
                style::Value::Token(reference) => self.reference(reference)?,
                style::Value::Expression(expression) => self.expression(expression)?,
                _ => {}
            }
        }

        for rule in style.rules.iter().flatten() {
            if let Some(condition) = &rule.condition
                && condition.starts_with("@media")
            {
                self.add(condition).map_err(Failure::into_error)?;
            }

            self.visit(&rule.style)?;
        }

        Ok(())
    }

    fn first_visit<T: ?Sized>(&mut self, value: *const T) -> bool {
        self.visited.insert(value.cast::<()>().addr())
    }

    fn reference(&mut self, reference: &Arc<Reference>) -> Result<()> {
        if !self.first_visit(Arc::as_ptr(reference)) {
            return Ok(());
        }

        self.token_value(&reference.value)?;

        for theme in self.catalog.into_iter().flat_map(Record::values) {
            let metadata = &theme.metadata;

            if shared(metadata, reference)
                && let Some(value) = metadata.values.get(&reference.path)
            {
                self.token_value(value)?;
            }
        }

        Ok(())
    }

    fn expression(&mut self, expression: &Arc<Expression>) -> Result<()> {
        if !self.first_visit(Arc::as_ptr(expression)) {
            return Ok(());
        }

        for part in &expression.parts {
            if let Part::Reference(reference) = part {
                self.reference(reference)?;
            }
        }

        Ok(())
    }

    fn token_value(&mut self, value: &TokenValue) -> Result<()> {
        match value {
            TokenValue::Reference(reference) => self.reference(reference),
            TokenValue::Composition(expression) => self.expression(expression),
            TokenValue::Record(entries) => {
                if !self.first_visit(Arc::as_ptr(entries)) {
                    return Ok(());
                }

                if value.field("default").is_some() {
                    for (name, entry) in entries.iter() {
                        if &**name != "default" {
                            match self.add(name) {
                                Ok(()) | Err(Failure::Unsupported(_)) => {}
                                Err(Failure::Error(error)) => return Err(error),
                            }
                        }

                        self.token_value(entry)?;
                    }
                } else if let (Some(light), Some(dark)) =
                    (value.field("light"), value.field("dark"))
                {
                    self.token_value(light)?;
                    self.token_value(dark)?;
                }

                Ok(())
            }
            TokenValue::Number(_) | TokenValue::String(_) => Ok(()),
        }
    }
}

/// Whether a set's values replace a reference's own value: the same contract, or one with the
/// same identity.
fn shared(metadata: &Metadata, reference: &Reference) -> bool {
    Arc::ptr_eq(&metadata.contract, &reference.contract)
        || (metadata.contract.identity.is_some()
            && metadata.contract.identity == reference.contract.identity)
}

fn parse(input: &str, options: &scalar::Options) -> std::result::Result<Query, Failure> {
    let Some(list) = input.strip_prefix("@media") else {
        return Err(Failure::unsupported(
            "Native conditional variables require media queries.",
        ));
    };
    let ast = zyzz_css_syntax::parse(list, &ParseOptions::context(Context::MediaQueryList))
        .map_err(|error| Failure::Error(Error::Message(error.message.into_owned())))?;
    let mut reader = Reader {
        ast: &ast,
        count: 0,
        options,
    };

    reader.read(ast.root())
}

struct Reader<'t, 'a, 'o> {
    ast: &'t Ast<'a>,
    count: usize,
    options: &'o scalar::Options,
}

impl Reader<'_, '_, '_> {
    fn read(&mut self, id: NodeId) -> std::result::Result<Query, Failure> {
        self.count += 1;

        if self.count > NODES {
            return Err(Failure::Error(Error::message(
                "Native media queries exceed 128 syntax nodes.",
            )));
        }

        let ast = self.ast;

        match ast.get(id) {
            Some(Node::MediaQueryList { children }) => {
                let mut queries = ast
                    .list(*children)
                    .iter()
                    .map(|child| self.read(*child))
                    .collect::<std::result::Result<Vec<_>, _>>()?;

                Ok(if queries.len() == 1 {
                    queries.remove(0)
                } else {
                    Query::Or(queries)
                })
            }
            Some(Node::MediaQuery {
                condition,
                media_type,
                modifier,
            }) => {
                if media_type.is_some_and(|media_type| {
                    !media_type.eq_ignore_ascii_case("all")
                        && !media_type.eq_ignore_ascii_case("screen")
                }) || modifier.is_some_and(|modifier| modifier.eq_ignore_ascii_case("not"))
                {
                    return Err(Failure::unsupported(
                        "Native media types support all or screen without negation.",
                    ));
                }

                match condition {
                    Some(condition) => self.read(*condition),
                    None => Ok(Query::Compare {
                        left: Operand::Number(0.0),
                        operator: Operator::Equal,
                        right: Operand::Number(0.0),
                    }),
                }
            }
            Some(Node::Condition { children, .. }) => self.condition(ast.list(*children)),
            Some(Node::FeatureRange {
                left,
                left_comparison,
                middle,
                right,
                right_comparison,
                ..
            }) => {
                let first = self.comparison(*left, Some(*left_comparison), *middle)?;

                match right {
                    Some(right) => Ok(Query::And(vec![
                        first,
                        self.comparison(*middle, *right_comparison, *right)?,
                    ])),
                    None => Ok(first),
                }
            }
            Some(Node::Feature { name, value, .. }) => self.feature(name, *value),
            _ => Err(unsupported_feature()),
        }
    }

    fn condition(&mut self, parts: &[NodeId]) -> std::result::Result<Query, Failure> {
        let ast = self.ast;
        let identifier = |id: Option<&NodeId>| match id.and_then(|id| ast.get(*id)) {
            Some(Node::Identifier { name }) => Some(name.to_ascii_lowercase()),
            _ => None,
        };

        if let [only] = parts {
            return self.read(*only);
        }

        if let [first, second] = parts
            && identifier(Some(first)).as_deref() == Some("not")
        {
            return Ok(Query::Not(Box::new(self.read(*second)?)));
        }

        let operator = identifier(parts.get(1));
        let valid = matches!(operator.as_deref(), Some("and" | "or"))
            && parts.len() % 2 == 1
            && parts
                .iter()
                .skip(1)
                .step_by(2)
                .all(|part| identifier(Some(part)) == operator);

        if !valid {
            return Err(Failure::unsupported("Unsupported native media condition."));
        }

        let queries = parts
            .iter()
            .step_by(2)
            .map(|part| self.read(*part))
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(if operator.as_deref() == Some("and") {
            Query::And(queries)
        } else {
            Query::Or(queries)
        })
    }

    fn feature(&self, name: &str, value: Option<NodeId>) -> std::result::Result<Query, Failure> {
        let name = name.to_ascii_lowercase();

        if name == "orientation"
            && let Some(Node::Identifier { name: orientation }) =
                value.and_then(|value| self.ast.get(value))
        {
            let landscape = orientation.eq_ignore_ascii_case("landscape");

            if landscape || orientation.eq_ignore_ascii_case("portrait") {
                return Ok(Query::Compare {
                    left: Operand::Width,
                    operator: if landscape {
                        Operator::Greater
                    } else {
                        Operator::LessEqual
                    },
                    right: Operand::Height,
                });
            }
        }

        let (prefix, dimension) = match name.split_once('-') {
            Some((prefix @ ("min" | "max"), dimension)) => (Some(prefix), dimension),
            _ => (None, name.as_str()),
        };
        let left = match dimension {
            "height" => Operand::Height,
            "width" => Operand::Width,
            _ => return Err(unsupported_feature()),
        };

        Ok(Query::Compare {
            left,
            operator: match prefix {
                Some("min") => Operator::GreaterEqual,
                Some(_) => Operator::LessEqual,
                None if value.is_some() => Operator::Equal,
                None => Operator::Greater,
            },
            right: match value {
                Some(value) => self.operand(value)?,
                None => Operand::Number(0.0),
            },
        })
    }

    fn comparison(
        &self,
        left: NodeId,
        operator: Option<&str>,
        right: NodeId,
    ) -> std::result::Result<Query, Failure> {
        let operator = match operator {
            Some("<") => Operator::Less,
            Some("<=") => Operator::LessEqual,
            Some("=") => Operator::Equal,
            Some(">") => Operator::Greater,
            Some(">=") => Operator::GreaterEqual,
            _ => return Err(Failure::unsupported("Unsupported native media comparison.")),
        };

        Ok(Query::Compare {
            left: self.operand(left)?,
            operator,
            right: self.operand(right)?,
        })
    }

    fn operand(&self, id: NodeId) -> std::result::Result<Operand, Failure> {
        match self.ast.get(id) {
            Some(Node::Identifier { name }) if name.eq_ignore_ascii_case("height") => {
                Ok(Operand::Height)
            }
            Some(Node::Identifier { name }) if name.eq_ignore_ascii_case("width") => {
                Ok(Operand::Width)
            }
            Some(Node::Dimension { unit, value }) => {
                let length = Scalar::String(format!("{value}{}", unit.to_lowercase()).into());

                scalar::length(&length, self.options, false)
                    .map(Operand::Number)
                    .map_err(|error| Failure::Unsupported(error.text()))
            }
            Some(Node::Number { value }) if js::to_number(value) == 0.0 => Ok(Operand::Number(0.0)),
            _ => Err(Failure::unsupported(
                "Native media ranges require width/height and px/rem thresholds.",
            )),
        }
    }
}

#[cold]
fn unsupported_feature() -> Failure {
    Failure::unsupported("Unsupported native media feature.")
}
