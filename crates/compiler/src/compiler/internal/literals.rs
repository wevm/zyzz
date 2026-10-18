//! Publishes statically resolved literal exports without executing library code.

use std::sync::Arc;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Declaration, Expression, ImportOrExportKind, ObjectPropertyKind, PropertyKind, Statement,
    UnaryOperator, VariableDeclarationKind,
};
use oxc_parser::{ParseOptions, Parser};
use oxc_span::{GetSpan, SourceType};
use rustc_hash::{FxHashMap, FxHashSet};

use crate::compiler::internal::{statics, syntax::Parsed};
use crate::js::{self, Record};

/// Reads a bounded literal expression. Calls, references, and executable properties are rejected.
pub(crate) fn read<'a>(allocator: &'a Allocator, source: &str) -> Option<&'a Expression<'a>> {
    let source = allocator.alloc_str(source);
    let expression = Parser::new(allocator, source, SourceType::mjs())
        .with_options(ParseOptions {
            preserve_parens: false,
            ..ParseOptions::default()
        })
        .parse_expression()
        .ok()?;
    write(&expression)?;

    Some(allocator.alloc(expression))
}

/// Serializes literal expressions, preserving property order and signed numeric values.
pub(crate) fn write(expression: &Expression<'_>) -> Option<Arc<str>> {
    let mut output = String::new();
    append(&mut output, expression, 0)?;

    Some(Arc::from(output))
}

fn append(output: &mut String, expression: &Expression<'_>, depth: usize) -> Option<()> {
    if depth > 64 {
        return None;
    }

    match expression {
        Expression::StringLiteral(value) => js::write_string(output, &value.value),
        Expression::NumericLiteral(value) if value.value.is_finite() => {
            js::write_number(output, value.value);
        }
        Expression::BooleanLiteral(value) => {
            output.push_str(if value.value { "true" } else { "false" });
        }
        Expression::NullLiteral(_) => output.push_str("null"),
        Expression::UnaryExpression(value)
            if matches!(value.argument, Expression::NumericLiteral(_)) =>
        {
            match value.operator {
                UnaryOperator::UnaryNegation => output.push('-'),
                UnaryOperator::UnaryPlus => output.push('+'),
                _ => return None,
            }

            append(output, &value.argument, depth + 1)?;
        }
        Expression::TemplateLiteral(value) if value.expressions.is_empty() => {
            js::write_string(output, value.quasis.first()?.value.cooked.as_ref()?);
        }
        Expression::ArrayExpression(value) => {
            output.push('[');

            for (index, element) in value.elements.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                append(output, element.as_expression()?, depth + 1)?;
            }

            output.push(']');
        }
        Expression::ObjectExpression(value) => {
            output.push('{');

            for (index, property) in value.properties.iter().enumerate() {
                let ObjectPropertyKind::ObjectProperty(property) = property else {
                    return None;
                };
                if property.method || property.kind != PropertyKind::Init {
                    return None;
                }
                if index > 0 {
                    output.push(',');
                }

                js::write_string(output, &statics::key_name(property)?);
                output.push(':');
                append(output, &property.value, depth + 1)?;
            }

            output.push('}');
        }
        _ => return None,
    }

    Some(())
}

/// Collects local literal exports in source order with one binding pass.
pub(crate) fn exports<'a>(
    allocator: &'a Allocator,
    parsed: &Parsed<'a>,
    imports: &Record<&'a Expression<'a>>,
) -> Record<Arc<str>> {
    let mut bindings: FxHashMap<&str, u32> = FxHashMap::default();
    let mut exported = Vec::new();
    let mut default = None;

    for statement in &parsed.program.body {
        if let Statement::ImportDeclaration(declaration) = statement {
            for specifier in declaration.specifiers.iter().flatten() {
                if imports.get(specifier.name().as_str()).is_some() {
                    bindings.insert(specifier.name().as_str(), specifier.span().start);
                }
            }
        }

        let declaration = match statement {
            Statement::ExportDeclaration(export)
                if export.export_kind() != ImportOrExportKind::Type =>
            {
                Some((&export.declaration, true))
            }
            statement => statement
                .as_declaration()
                .map(|declaration| (declaration, false)),
        };

        if let Some((Declaration::VariableDeclaration(declaration), public)) = declaration
            && declaration.kind == VariableDeclarationKind::Const
        {
            for declaration in &declaration.declarations {
                if let Some(identifier) = declaration.id.get_binding_identifier()
                    && declaration.init.is_some()
                {
                    bindings.insert(identifier.name.as_str(), declaration.span.start);

                    if public {
                        exported.push((identifier.name.as_str(), identifier.name.as_str()));
                    }
                }
            }
        }

        if let Statement::ExportNamedDeclaration(declaration) = statement
            && declaration.export_kind != ImportOrExportKind::Type
        {
            for specifier in &declaration.specifiers {
                if specifier.export_kind != ImportOrExportKind::Type {
                    exported.push((
                        specifier.exported.name().as_str(),
                        specifier.local.name().as_str(),
                    ));
                }
            }
        }

        if let Statement::ExportDefaultDeclaration(declaration) = statement {
            default = declaration.declaration.as_expression();
        }
    }

    let data = statics::collect(
        allocator,
        parsed.program,
        &parsed.semantic,
        imports
            .iter()
            .map(|(name, value)| (name.to_string(), *value))
            .collect(),
    );
    let normalize = |value| {
        data.normalize(value, &FxHashSet::default(), &FxHashSet::default(), true)
            .ok()
            .and_then(write)
    };
    let mut result = Record::new();

    for (exported, local) in exported {
        if let Some(value) = bindings
            .get(local)
            .and_then(|binding| data.constant(local, *binding).ok())
            .and_then(write)
        {
            result.insert(exported, value);
        }
    }

    if let Some(value) = default.and_then(normalize) {
        result.insert("default", value);
    }

    result
}
