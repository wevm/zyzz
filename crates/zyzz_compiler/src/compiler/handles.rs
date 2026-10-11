//! The JSON boundary of graph and module compilation.
//!
//! A [`Compiler`] belongs to one host compiler object, so its caches live exactly as long as the
//! host references it. Its results mark modules whose output is the value its previous result
//! held, which lets hosts keep their decoded objects.

use std::sync::Arc;

use rustc_hash::FxHashMap;
use serde_json::Value;

use crate::compiler::graph::{self, Graph, Map, Output, Resource};
use crate::compiler::internal::stylesheets::Rendered;
use crate::compiler::transform;
use crate::error::{Error, Result};
use crate::internal::token::{Composition, CssOutput};
use crate::js;
use crate::web::internal::themes::Shared;

fn malformed(message: &str) -> Error {
    Error::Message(format!("Malformed graph input: {message}"))
}

fn strings(value: Option<&Value>, field: &str) -> Result<Option<Map<Arc<str>>>> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Object(object)) => object
            .iter()
            .map(|(key, value)| {
                value
                    .as_str()
                    .map(|value| (Arc::from(key.as_str()), Arc::from(value)))
                    .ok_or_else(|| malformed(field))
            })
            .collect::<Result<_>>()
            .map(Some),
        Some(_) => Err(malformed(field)),
    }
}

fn text(value: Option<&Value>) -> Option<Arc<str>> {
    value.and_then(Value::as_str).map(Arc::from)
}

/// Decodes graph options from their JSON form.
///
/// # Errors
///
/// Returns a plain error for malformed input.
pub fn options(input: &Value) -> Result<graph::Options> {
    let field = |name: &str| input.get(name).filter(|value| !value.is_null());
    let imports = match field("imports") {
        None => None,
        Some(Value::Object(imports)) => Some(
            imports
                .iter()
                .map(|(id, specifiers)| {
                    let Value::Object(specifiers) = specifiers else {
                        return Err(malformed("imports"));
                    };
                    let specifiers = specifiers
                        .iter()
                        .map(|(specifier, target)| match target {
                            Value::Null => Ok((Arc::from(specifier.as_str()), None)),
                            Value::String(target) => Ok((
                                Arc::from(specifier.as_str()),
                                Some(Arc::from(target.as_str())),
                            )),
                            _ => Err(malformed("imports")),
                        })
                        .collect::<Result<_>>()?;

                    Ok((Arc::from(id.as_str()), specifiers))
                })
                .collect::<Result<_>>()?,
        ),
        Some(_) => return Err(malformed("imports")),
    };
    let composition = match field("composition").and_then(Value::as_str) {
        None => None,
        Some(value) => Some(Composition::parse(value).ok_or_else(|| malformed("composition"))?),
    };
    let css_output = match field("cssOutput").and_then(Value::as_str) {
        None => None,
        Some(value) => Some(CssOutput::parse(value).ok_or_else(|| malformed("cssOutput"))?),
    };
    let shared = match field("shared").and_then(Value::as_str) {
        None => None,
        Some("all") => Some(Shared::All),
        Some("defaults") => Some(Shared::Defaults),
        Some(_) => return Err(malformed("shared")),
    };

    Ok(graph::Options {
        complete: field("complete")
            .and_then(Value::as_bool)
            .unwrap_or_default(),
        compiler: field("compiler").and_then(Value::as_bool),
        composition,
        contracts: strings(field("contracts"), "contracts")?,
        css_output,
        development: field("development")
            .and_then(Value::as_bool)
            .unwrap_or_default(),
        entry: text(field("entry")),
        imports,
        modules: strings(field("modules"), "modules")?.unwrap_or_default(),
        reset: text(field("reset")),
        shared,
    })
}

fn write_record<'r>(output: &mut String, entries: impl Iterator<Item = (&'r str, &'r str)>) {
    js::write_object(output, entries, js::write_string);
}

fn write_rendered(output: &mut String, rendered: &Rendered) {
    output.push_str("\"assets\":");
    write_record(
        output,
        rendered
            .assets
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str())),
    );
    output.push_str(",\"css\":");
    js::write_string(output, &rendered.css);
    output.push_str(",\"map\":");
    output.push_str(&rendered.map.to_json());
    output.push_str(",\"owners\":");
    write_record(
        output,
        rendered
            .owners
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str())),
    );
}

fn write_resource(output: &mut String, resource: &Resource) {
    output.push_str("{\"id\":");
    js::write_string(output, &resource.id);
    output.push(',');
    write_rendered(output, &resource.rendered);
    output.push('}');
}

/// Appends one module's transform output.
pub fn write_module(output: &mut String, module: &transform::Output) {
    output.push_str("{\"classes\":");
    write_record(
        output,
        module
            .classes
            .iter()
            .map(|(name, value)| (&**name, value.as_str())),
    );
    output.push_str(",\"code\":");
    js::write_string(output, &module.code);
    output.push_str(",\"css\":");
    js::write_string(output, &module.css);
    output.push_str(",\"cssMap\":");
    output.push_str(&module.css_map.to_json());
    output.push_str(",\"map\":");
    output.push_str(&module.map);
    output.push_str(",\"rules\":");
    write_record(
        output,
        module
            .rules
            .iter()
            .map(|(name, rule)| (name.as_str(), rule.as_str())),
    );

    if let Some(resources) = &module.shared {
        output.push_str(",\"shared\":[");

        for (index, resource) in resources.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            output.push_str("{\"css\":");
            js::write_string(output, &resource.css);
            output.push_str(",\"id\":");
            js::write_string(output, &resource.id);

            if let Some(rules) = &resource.rules {
                output.push_str(",\"rules\":[");

                for (index, rule) in rules.iter().enumerate() {
                    if index > 0 {
                        output.push(',');
                    }

                    output.push_str("{\"conditions\":[");

                    for (index, condition) in rule.conditions.iter().enumerate() {
                        if index > 0 {
                            output.push(',');
                        }

                        js::write_string(output, condition);
                    }

                    output.push_str("],\"property\":");
                    js::write_string(output, &rule.property);
                    output.push_str(",\"selector\":");
                    js::write_string(output, &rule.selector);
                    output.push_str(",\"value\":");
                    js::write_string(output, &rule.value);
                    output.push('}');
                }

                output.push(']');
            }

            output.push('}');
        }

        output.push(']');
    }

    output.push_str(",\"units\":[");

    for (index, (key, decision)) in module.units.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        output.push('[');
        js::write_string(output, key);
        output.push_str(if decision.borrowed {
            ",true,"
        } else {
            ",false,"
        });
        js::write_string(output, &decision.name);
        output.push(']');
    }

    output.push_str("],\"vars\":");
    write_record(
        output,
        module
            .vars
            .iter()
            .map(|(name, value)| (&**name, value.as_str())),
    );
    output.push('}');
}

/// Serializes a graph result. Modules whose output is the value `previous` holds become `0`.
pub fn write_output(result: &Output, previous: Option<&Output>) -> String {
    let mut output = String::from("{\"contracts\":");

    write_record(
        &mut output,
        result
            .contracts
            .iter()
            .map(|(id, contract)| (&**id, contract.as_str())),
    );
    output.push_str(",\"dependencies\":");
    js::write_object(
        &mut output,
        result
            .dependencies
            .iter()
            .map(|(id, targets)| (&**id, targets)),
        |output, targets| {
            output.push('[');

            for (index, target) in targets.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                js::write_string(output, target);
            }

            output.push(']');
        },
    );
    output.push_str(",\"modules\":");
    js::write_object(
        &mut output,
        result
            .modules
            .iter()
            .map(|(id, module)| (&**id, (id, module))),
        |output, (id, module)| {
            let same = previous
                .and_then(|previous| previous.modules.get(&**id))
                .is_some_and(|previous| Arc::ptr_eq(previous, module));

            if same {
                output.push('0');
            } else {
                write_module(output, module);
            }
        },
    );

    if !result.packed.is_empty() {
        output.push_str(",\"packed\":[");

        for (index, resource) in result.packed.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            write_resource(&mut output, resource);
        }

        output.push(']');
    }

    if let Some(reset) = &result.reset {
        output.push_str(",\"reset\":");
        write_resource(&mut output, reset);
    }

    if let Some(shared) = &result.shared {
        output.push_str(",\"shared\":{");
        write_rendered(&mut output, shared);
        output.push('}');
    }

    output.push('}');
    output
}

/// Compiles a snapshot without retained state.
///
/// # Errors
///
/// Returns the graph's compilation errors and malformed input.
pub fn compile(input: &Value) -> Result<String> {
    Ok(write_output(&*graph::compile(&options(input)?)?, None))
}

/// An incremental graph compiler with the result of its previous snapshot.
#[derive(Default)]
pub struct Compiler {
    graph: Graph,
    previous: Option<Arc<Output>>,
}

impl Compiler {
    /// Compiles a snapshot of JSON graph options. A result identical to the previous one
    /// serializes as `{"same":true}`, and failures as an error result.
    pub fn compile(&mut self, input: &str) -> String {
        let result = serde_json::from_str::<Value>(input)
            .map_err(|error| Error::Message(error.to_string()))
            .and_then(|input| options(&input))
            .and_then(|options| self.graph.compile(&options));

        match result {
            Ok(result) => {
                let same = self
                    .previous
                    .as_ref()
                    .is_some_and(|previous| Arc::ptr_eq(previous, &result));
                let written = if same {
                    "{\"same\":true}".to_owned()
                } else {
                    write_output(&result, self.previous.as_deref())
                };

                self.previous = Some(result);
                written
            }
            Err(error) => crate::api::error_json(&error),
        }
    }
}

/// Compiles one module outside a graph, as `Transform.compile` does.
///
/// # Errors
///
/// Returns extraction and emission errors, and the TypeScript message for native targets.
pub fn transform(input: &Value) -> Result<String> {
    let field = |name: &str| input.get(name).filter(|value| !value.is_null());

    if field("target").and_then(Value::as_str) == Some("native") {
        return Err(Error::Message(
            "Use Native.compile for native source output.".to_owned(),
        ));
    }

    let module_id = field("moduleId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let source = field("source").and_then(Value::as_str).unwrap_or_default();
    let compiler = field("compiler").and_then(Value::as_bool);
    let options = options(input)?;
    let allocator = oxc_allocator::Allocator::default();
    let parsed = crate::compiler::internal::syntax::parse(&allocator, source, module_id);
    let extracted = crate::compiler::source::extract(
        &allocator,
        &crate::compiler::source::Options {
            compiler,
            context: None,
            module_id,
            parsed: Some(&parsed),
            source,
            target: crate::compiler::source::Target::Web,
        },
    )?;
    let output = transform::compile(
        &transform::Options {
            compiler: compiler != Some(false),
            composition: options.composition,
            css_output: options.css_output,
            development: options.development,
            module_id,
            owners: None,
            schemes: field("schemes").and_then(Value::as_bool),
            shared: options.shared,
            source,
            style_classes: None,
        },
        &extracted,
        &parsed,
        None,
    )?;
    let mut written = String::new();

    write_module(&mut written, &output);

    Ok(written)
}

/// Reads a library contract and lists each packed stylesheet section's import chain, which hosts
/// resolve before compiling the graph.
///
/// # Errors
///
/// Returns the contract reader's validation errors.
pub fn dependencies(input: &Value) -> Result<String> {
    let field = |name: &str| input.get(name).and_then(Value::as_str).unwrap_or_default();
    let identifier = |value: &str| crate::compiler::internal::identifiers::read(value);
    let validate =
        |filename: &str, css: &str| crate::compiler::internal::at_rules::validate(css, filename);
    let hooks = crate::compiler::internal::contract::Hooks {
        identifier: &identifier,
        validate: &validate,
    };
    let library = crate::compiler::internal::contract::read(
        field("contract"),
        &mut FxHashMap::default(),
        field("moduleId"),
        &hooks,
    )?;
    let mut output = String::from("{\"dependencies\":[");

    for (index, section) in library.stylesheets.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        output.push('[');

        for (index, specifier) in section.dependency.iter().flatten().enumerate() {
            if index > 0 {
                output.push(',');
            }

            js::write_string(&mut output, specifier);
        }

        output.push(']');
    }

    output.push_str("]}");

    Ok(output)
}
